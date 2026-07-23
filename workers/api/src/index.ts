/**
 * Con-Sche API（Cloudflare Workers + D1）
 *
 * POST /api/register { name, company, email }
 *   → 201 { apiKey } 新規登録・APIコード発行（平文はこのレスポンス1回のみ）
 *   → 409 { alreadyRegistered: true } 登録済みメールアドレス
 *   → 400 { error } バリデーションエラー
 *   → 429 { error } レート制限
 *
 * POST /api/contact { companyName, name, email, ... }
 *   → 201 {} お問い合わせをD1に保存
 *
 * GET /api/announcements
 *   → 200 { announcements: [{ id, title, body, created_at }] } 公開中のお知らせ（新しい順・最大20件）
 *
 * /api/v1/* → 連携API（要APIコード認証・従量カウント）。実装は v1.ts
 *
 * セキュリティ方針:
 * - APIキーはSHA-256ハッシュのみDBに保存する
 * - SQLはすべてprepared statement
 * - 個人情報の読み出し用エンドポイントは持たない（/api/v1/usage は自キーの集計値のみ）
 */

import { handleV1 } from './v1';
import { extractToken, safeEqual } from './adminAuth';
import { buildUnsubUrl, unsubSignature, verifyUnsubSignature } from './unsub';

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  /** 任意: 登録・拒否イベントを通知する Slack Incoming Webhook（wrangler secret put SLACK_WEBHOOK_URL）。未設定なら通知しない */
  SLACK_WEBHOOK_URL?: string;
  /** 任意: 確認メール送信用の Resend APIキー（wrangler secret put RESEND_API_KEY）。
   *  設定するとメール確認方式（登録→確認リンク→キー発行）になり、未設定なら従来どおり即時キー発行 */
  RESEND_API_KEY?: string;
  /** 任意: 確認メールの送信元。未設定時は MAIL_FROM_DEFAULT */
  MAIL_FROM?: string;
  /** 任意: 確認リンクのベースURL（フロントの /verify ページがあるオリジン）。未設定時は VERIFY_BASE_DEFAULT */
  VERIFY_BASE_URL?: string;
  /** 任意: 運営用の読み取り専用集計 GET /api/admin/stats を有効化するトークン
   *  （wrangler secret put ADMIN_STATS_TOKEN）。未設定ならエンドポイント自体が404 */
  ADMIN_STATS_TOKEN?: string;
  /** 任意: お問い合わせ受信をメール通知する宛先（wrangler secret put CONTACT_NOTIFY_TO）。
   *  RESEND_API_KEY とセットで設定すると有効。未設定なら通知しない（D1保存のみ） */
  CONTACT_NOTIFY_TO?: string;
  /** 任意: 配信停止リンクの署名鍵（wrangler secret put UNSUB_SECRET）。
   *  未設定なら /api/unsubscribe と /api/admin/broadcast は404 */
  UNSUB_SECRET?: string;
}

const MAIL_FROM_DEFAULT = 'Con-Sche <noreply@tatelog.biz>';
const VERIFY_BASE_DEFAULT = 'https://con-sche.tatelog.biz';
const PENDING_TTL_HOURS = 24;

/** 確認メールをResendで送信。成功でtrue（失敗時は呼び出し側でエラー応答にする） */
async function sendVerificationEmail(env: Env, to: string, name: string, token: string): Promise<boolean> {
  const verifyUrl = `${env.VERIFY_BASE_URL || VERIFY_BASE_DEFAULT}/verify?token=${token}`;
  const text = [
    `${name} 様`,
    '',
    'Con-Sche（ネットワーク工程表）へのご登録ありがとうございます。',
    `以下のリンクをクリックすると登録が完了し、APIコードが発行されます（有効期限: ${PENDING_TTL_HOURS}時間）。`,
    '',
    verifyUrl,
    '',
    '心当たりがない場合は、このメールを無視してください（登録は完了しません）。',
    '',
    '株式会社建ログ / Con-Sche',
    'https://con-sche.tatelog.biz',
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM || MAIL_FROM_DEFAULT,
        to: [to],
        subject: '【Con-Sche】メールアドレスの確認',
        text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Slack通知（fire-and-forget。未設定・失敗とも本処理に影響させない） */
async function notifySlack(env: Env, text: string): Promise<void> {
  if (!env.SLACK_WEBHOOK_URL) return;
  try {
    await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch {
    // 通知失敗は無視
  }
}

// src/config/blockedDomains.ts と同じリスト。変更時は両方更新すること。
const BLOCKED_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.co.jp', 'yahoo.com', 'ymail.ne.jp',
  'hotmail.com', 'hotmail.co.jp', 'outlook.com', 'outlook.jp', 'live.jp',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'protonmail.com', 'proton.me', 'gmx.com', 'mail.com',
  'docomo.ne.jp', 'ezweb.ne.jp', 'au.com', 'softbank.ne.jp', 'i.softbank.jp',
  'ymobile.ne.jp', 'rakuten.jp', 'rakumail.jp', 'mineo.jp', 'uqmobile.jp',
];

const RATE_LIMIT_PER_HOUR = 5;

export function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function json(env: Env, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `cs_live_${hex}`;
}

/** メール確認リンク用トークン（32バイトhex） */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 顧客作成 + APIキー発行（ハッシュのみ保存）。
 * 戻り値: 平文APIキー / 'duplicate'（メール重複） / null（その他失敗）
 */
async function issueCustomerKey(
  env: Env,
  name: string,
  company: string,
  email: string,
  now: string,
  ip: string
): Promise<string | 'duplicate' | null> {
  const customerId = crypto.randomUUID();
  const keyId = crypto.randomUUID();
  const apiKey = generateApiKey();
  const keyHash = await sha256Hex(apiKey);

  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO customers (id, name, company, email, created_at, ip) VALUES (?1, ?2, ?3, ?4, ?5, ?6)'
      ).bind(customerId, name, company, email, now, ip),
      env.DB.prepare(
        "INSERT INTO api_keys (id, customer_id, key_hash, plan, status, created_at) VALUES (?1, ?2, ?3, 'free', 'active', ?4)"
      ).bind(keyId, customerId, keyHash, now),
    ]);
  } catch (e) {
    // UNIQUE制約競合（同時登録）は登録済み扱い
    const message = e instanceof Error ? e.message : '';
    if (message.includes('UNIQUE')) {
      return 'duplicate';
    }
    return null;
  }
  return apiKey;
}

/** メール確認リンクの検証 → 本登録（キー発行） */
async function handleVerify(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return json(env, 400, { error: 'リクエスト形式が不正です。' });
  }
  const token = (body.token ?? '').trim();
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return json(env, 404, { error: '確認リンクが無効です。お手数ですが、もう一度登録してください。' });
  }

  const now = new Date().toISOString();
  const pending = await env.DB.prepare(
    'SELECT name, company, email, ip FROM pending_registrations WHERE token = ?1 AND expires_at >= ?2'
  ).bind(token, now).first<{ name: string; company: string; email: string; ip: string | null }>();

  if (!pending) {
    return json(env, 404, { error: '確認リンクが無効か、有効期限が切れています。お手数ですが、もう一度登録してください。' });
  }

  const issued = await issueCustomerKey(env, pending.name, pending.company, pending.email, now, pending.ip ?? 'unknown');

  // 同一メールのpendingは全て掃除（重複クリック・再登録分）
  await env.DB.prepare('DELETE FROM pending_registrations WHERE email = ?1').bind(pending.email).run();

  if (issued === 'duplicate') {
    // 既に確認済み（二重クリック等）: ゲートは通す
    return json(env, 409, { alreadyRegistered: true });
  }
  if (issued === null) {
    return json(env, 500, { error: '登録処理に失敗しました。時間をおいて再度お試しください。' });
  }

  ctx.waitUntil(notifySlack(env,
    `:tada: *新規登録（メール確認済み）*\n会社: ${pending.company}\n氏名: ${pending.name}\nメール: ${pending.email}`
  ));

  return json(env, 201, { apiKey: issued });
}

/** お問い合わせ受信を運営宛にメール通知する（失敗しても問い合わせ保存自体は成功扱い） */
async function notifyContactByEmail(
  env: Env,
  c: { company: string; name: string; email: string; topics: string; message: string },
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.CONTACT_NOTIFY_TO) return;
  const text = [
    'Con-Sche にお問い合わせが届きました。',
    '',
    `会社名: ${c.company}`,
    `氏名: ${c.name}`,
    `メール: ${c.email}`,
    `種別: ${c.topics || '-'}`,
    '',
    '--- 本文 ---',
    c.message || '(本文なし)',
    '',
    'このメールに返信すると送信者に直接届きます（Reply-To設定済み）。',
  ].join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM || MAIL_FROM_DEFAULT,
        to: [env.CONTACT_NOTIFY_TO],
        reply_to: c.email,
        subject: `【Con-Sche】お問い合わせ: ${c.company} ${c.name}様`,
        text,
      }),
    });
  } catch {
    // 通知失敗は握りつぶす（問い合わせ本体はD1に保存済み・翌朝のNotion転記でも拾える）
  }
}

/** 配信停止ページのHTML（依存を持たない素の1枚） */
function unsubHtml(title: string, message: string): Response {
  return new Response(
    `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title} | Con-Sche</title></head>` +
    `<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:90vh;margin:0;background:#f8fafc">` +
    `<div style="text-align:center;padding:2rem;max-width:28rem"><h1 style="font-size:1.25rem;color:#1e293b">${title}</h1>` +
    `<p style="color:#475569;font-size:.9rem;line-height:1.7">${message}</p>` +
    `<p style="margin-top:2rem"><a href="https://con-sche.tatelog.biz/" style="color:#2563eb;font-size:.85rem">Con-Sche トップへ</a></p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * ワンクリック配信停止（GET=メール本文のリンク / POST=List-Unsubscribe-Postのワンクリック）
 * 署名検証が通ったメールの opt_out_at を記録する
 */
async function handleUnsubscribe(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.UNSUB_SECRET) return json(env, 404, { error: 'Not found' });
  const email = (url.searchParams.get('e') ?? '').toLowerCase();
  const sig = url.searchParams.get('sig') ?? '';
  if (!email || !(await verifyUnsubSignature(email, sig, env.UNSUB_SECRET))) {
    return unsubHtml('リンクが無効です', 'お手数ですが、お受け取りになったメールへの返信で配信停止の旨をお知らせください。');
  }
  await env.DB.prepare(
    "UPDATE customers SET opt_out_at = ?1 WHERE email = ?2 AND opt_out_at IS NULL"
  ).bind(new Date().toISOString(), email).run();
  if (request.method === 'POST') return new Response(null, { status: 200 });
  return unsubHtml('配信を停止しました', `${email} 宛の案内メールを今後お送りしません。アプリは引き続きご利用いただけます。`);
}

/**
 * 案内メールの一括配信（運営用・要ADMIN_STATS_TOKEN）
 * body: { subject, text, testTo? }
 * - testTo指定時はそのアドレス1件のみに送る（本番配信前の見た目確認用）
 * - 宛先: 有効・配信停止していない・自社以外の全登録者
 * - 各メールに本人専用の配信停止リンク（本文末尾+List-Unsubscribeヘッダー）を付与
 */
async function handleAdminBroadcast(request: Request, env: Env, url: URL): Promise<Response> {
  const expected = env.ADMIN_STATS_TOKEN;
  if (!expected || !safeEqual(extractToken(request.headers.get('Authorization'), url), expected)) {
    return json(env, 404, { error: 'Not found' });
  }
  if (!env.RESEND_API_KEY || !env.UNSUB_SECRET) {
    return json(env, 500, { error: 'RESEND_API_KEY / UNSUB_SECRET が未設定です。' });
  }

  let body: { subject?: string; text?: string; testTo?: string };
  try {
    body = await request.json();
  } catch {
    return json(env, 400, { error: 'リクエスト形式が不正です。' });
  }
  const subject = (body.subject ?? '').trim();
  const text = (body.text ?? '').trim();
  if (!subject || !text) return json(env, 400, { error: 'subject と text は必須です。' });

  let recipients: string[];
  if (body.testTo) {
    recipients = [body.testTo.toLowerCase()];
  } else {
    const rows = await env.DB.prepare(
      "SELECT email FROM customers WHERE deleted_at IS NULL AND opt_out_at IS NULL AND email NOT LIKE '%@tatelog.biz' ORDER BY created_at"
    ).all<{ email: string }>();
    recipients = (rows.results ?? []).map((r) => r.email);
  }
  if (recipients.length === 0) return json(env, 200, { sent: 0 });

  const apiBase = `${url.protocol}//${url.host}`;
  const emails = await Promise.all(recipients.map(async (to) => {
    const unsubUrl = buildUnsubUrl(apiBase, to, await unsubSignature(to, env.UNSUB_SECRET!));
    return {
      from: env.MAIL_FROM || MAIL_FROM_DEFAULT,
      to: [to],
      reply_to: env.CONTACT_NOTIFY_TO,
      subject,
      text: `${text}\n\n―――\n配信停止をご希望の方はこちら（ワンクリックで停止できます）:\n${unsubUrl}\n`,
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };
  }));

  // Resendのバッチは1回100件まで
  let sent = 0;
  const errors: string[] = [];
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (res.ok) {
      sent += chunk.length;
    } else {
      errors.push(`batch ${i / 100 + 1}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    }
  }
  return json(env, errors.length ? 502 : 200, { sent, total: emails.length, errors });
}

/**
 * 運営用の読み取り専用集計（Cowork等の定期レポートが叩く）
 * - ADMIN_STATS_TOKEN 未設定なら404（OSSセルフホストでは存在しない扱い）
 * - トークン不一致も404（エンドポイントの存在を隠す）
 */
async function handleAdminStats(request: Request, env: Env, url: URL): Promise<Response> {
  const expected = env.ADMIN_STATS_TOKEN;
  if (!expected) return json(env, 404, { error: 'Not found' });
  if (!safeEqual(extractToken(request.headers.get('Authorization'), url), expected)) {
    return json(env, 404, { error: 'Not found' });
  }

  const customers = await env.DB.prepare(
    'SELECT company, name, email, created_at, deleted_at FROM customers ORDER BY created_at'
  ).all();
  const usage = await env.DB.prepare(
    'SELECT c.email AS email, SUM(l.units) AS pts, COUNT(*) AS calls, MAX(l.created_at) AS last_use ' +
    'FROM usage_logs l JOIN api_keys k ON l.key_id = k.id JOIN customers c ON k.customer_id = c.id GROUP BY c.email'
  ).all();
  const contacts = await env.DB.prepare(
    'SELECT id, company, name, email, topics, message, created_at FROM contacts ORDER BY created_at DESC LIMIT 50'
  ).all();

  return json(env, 200, {
    generated_at: new Date().toISOString(),
    customers: customers.results ?? [],
    usage: usage.results ?? [],
    contacts: contacts.results ?? [],
  });
}

async function handleAnnouncements(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    'SELECT id, title, body, created_at FROM announcements WHERE published = 1 ORDER BY created_at DESC LIMIT 20'
  ).all<{ id: string; title: string; body: string; created_at: string }>();
  // キャッシュはしない: 既読判定（赤ドット）が古い応答に引きずられるのを避ける。アクセス規模的にも不要
  return json(env, 200, { announcements: rows.results ?? [] });
}

async function handleContact(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(env, 400, { error: 'リクエスト形式が不正です。' });
  }

  const str = (key: string, max: number): string => {
    const v = body[key];
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
  };
  const company = str('companyName', 200);
  const name = str('name', 100);
  const email = str('email', 254);
  const inquiryTypes = Array.isArray(body.inquiryTypes)
    ? (body.inquiryTypes as unknown[]).filter((t) => typeof t === 'string').slice(0, 10) as string[]
    : [];

  if (!company || !name || !email || inquiryTypes.length === 0) {
    return json(env, 400, { error: '必須項目を入力してください。' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(env, 400, { error: 'メールアドレスの形式が正しくありません。' });
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const now = new Date().toISOString();

  // レート制限: 同一IPから1時間にN件まで
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM contacts WHERE ip = ?1 AND created_at > ?2'
  ).bind(ip, oneHourAgo).first<{ cnt: number }>();
  if ((recent?.cnt ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return json(env, 429, { error: '送信リクエストが多すぎます。時間をおいて再度お試しください。' });
  }

  const topics = [...inquiryTypes, str('otherPurpose', 200)].filter(Boolean).join(', ');
  const contactMethod = [str('contactMethod', 20), str('preferredTime', 50)].filter(Boolean).join(' / ');

  await env.DB.prepare(
    `INSERT INTO contacts (id, company, name, email, phone, position, department, role, topics, contact_method, message, created_at, ip)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
  ).bind(
    crypto.randomUUID(),
    company,
    name,
    email,
    str('phone', 50),
    str('jobTitle', 100),
    str('department', 100),
    str('role', 100),
    topics,
    contactMethod,
    str('message', 4000),
    now,
    ip,
  ).run();

  ctx.waitUntil(notifyContactByEmail(env, {
    company, name, email, topics, message: str('message', 4000),
  }));

  return json(env, 201, {});
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    // 連携API v1（要認証・従量カウント）
    if (url.pathname.startsWith('/api/v1/')) {
      return handleV1(request, env, url);
    }

    if (url.pathname === '/api/contact' && request.method === 'POST') {
      return handleContact(request, env, ctx);
    }

    if (url.pathname === '/api/announcements' && request.method === 'GET') {
      return handleAnnouncements(env);
    }

    if (url.pathname === '/api/admin/stats' && request.method === 'GET') {
      return handleAdminStats(request, env, url);
    }

    if (url.pathname === '/api/unsubscribe' && (request.method === 'GET' || request.method === 'POST')) {
      return handleUnsubscribe(request, env, url);
    }

    if (url.pathname === '/api/admin/broadcast' && request.method === 'POST') {
      return handleAdminBroadcast(request, env, url);
    }

    if (url.pathname === '/api/verify' && request.method === 'POST') {
      return handleVerify(request, env, ctx);
    }

    if (url.pathname !== '/api/register' || request.method !== 'POST') {
      return json(env, 404, { error: 'Not found' });
    }

    let body: { name?: string; company?: string; email?: string };
    try {
      body = await request.json();
    } catch {
      return json(env, 400, { error: 'リクエスト形式が不正です。' });
    }

    const name = (body.name ?? '').trim();
    const company = (body.company ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();

    // バリデーション
    if (!name || !company || !email) {
      return json(env, 400, { error: 'すべての項目を入力してください。' });
    }
    if (name.length > 100 || company.length > 200 || email.length > 254) {
      return json(env, 400, { error: '入力が長すぎます。' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(env, 400, { error: 'メールアドレスの形式が正しくありません。' });
    }
    const domain = email.split('@')[1];
    if (BLOCKED_DOMAINS.includes(domain)) {
      return json(env, 400, {
        error: 'フリーメール・携帯キャリアのアドレスはご利用いただけません。会社のメールアドレスで登録してください。',
      });
    }

    // 運営管理の登録不可ドメイン（D1の blocked_domains テーブル。サブドメインも一致する）
    const blocked = await env.DB.prepare(
      "SELECT domain, note FROM blocked_domains WHERE ?1 = domain OR ?1 LIKE '%.' || domain LIMIT 1"
    ).bind(domain).first<{ domain: string; note: string | null }>();
    if (blocked) {
      ctx.waitUntil(notifySlack(env,
        `:no_entry: *登録ブロック*\nリスト: ${blocked.note ?? blocked.domain}\nメール: ${email}\n会社: ${company} / 氏名: ${name}\nIP: ${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`
      ));
      return json(env, 400, {
        error: '恐れ入りますが、このドメインからのご登録は現在受け付けておりません。ご不明な点はお問い合わせください。',
      });
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const now = new Date().toISOString();

    // レート制限: 同一IPから1時間にN件まで
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await env.DB.prepare(
      'SELECT COUNT(*) AS cnt FROM customers WHERE ip = ?1 AND created_at > ?2'
    ).bind(ip, oneHourAgo).first<{ cnt: number }>();
    if ((recent?.cnt ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return json(env, 429, { error: '登録リクエストが多すぎます。時間をおいて再度お試しください。' });
    }

    // 登録済みチェック
    const existing = await env.DB.prepare(
      'SELECT id FROM customers WHERE email = ?1'
    ).bind(email).first<{ id: string }>();
    if (existing) {
      return json(env, 409, { alreadyRegistered: true });
    }

    // メール確認方式（RESEND_API_KEY設定時）: pendingに保存して確認メールを送る。
    // キー発行は /api/verify で行う。未設定環境（セルフホスト等）は従来どおり即時発行。
    if (env.RESEND_API_KEY) {
      // 期限切れpendingの掃除（ついで実行）
      await env.DB.prepare('DELETE FROM pending_registrations WHERE expires_at < ?1').bind(now).run();

      const token = generateToken();
      const expiresAt = new Date(Date.now() + PENDING_TTL_HOURS * 60 * 60 * 1000).toISOString();
      await env.DB.prepare(
        'INSERT INTO pending_registrations (token, name, company, email, created_at, expires_at, ip) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
      ).bind(token, name, company, email, now, expiresAt, ip).run();

      const sent = await sendVerificationEmail(env, email, name, token);
      if (!sent) {
        await env.DB.prepare('DELETE FROM pending_registrations WHERE token = ?1').bind(token).run();
        return json(env, 500, { error: '確認メールを送信できませんでした。メールアドレスをご確認のうえ、時間をおいて再度お試しください。' });
      }
      return json(env, 201, { pendingVerification: true });
    }

    const issued = await issueCustomerKey(env, name, company, email, now, ip);
    if (issued === 'duplicate') {
      return json(env, 409, { alreadyRegistered: true });
    }
    if (issued === null) {
      return json(env, 500, { error: '登録処理に失敗しました。時間をおいて再度お試しください。' });
    }

    ctx.waitUntil(notifySlack(env,
      `:tada: *新規登録*\n会社: ${company}\n氏名: ${name}\nメール: ${email}`
    ));

    return json(env, 201, { apiKey: issued });
  },
};
