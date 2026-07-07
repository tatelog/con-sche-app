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
 * /api/v1/* → 連携API（要APIコード認証・従量カウント）。実装は v1.ts
 *
 * セキュリティ方針:
 * - APIキーはSHA-256ハッシュのみDBに保存する
 * - SQLはすべてprepared statement
 * - 個人情報の読み出し用エンドポイントは持たない（/api/v1/usage は自キーの集計値のみ）
 */

import { handleV1 } from './v1';

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
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

async function handleContact(request: Request, env: Env): Promise<Response> {
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

  return json(env, 201, {});
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    // 連携API v1（要認証・従量カウント）
    if (url.pathname.startsWith('/api/v1/')) {
      return handleV1(request, env, url);
    }

    if (url.pathname === '/api/contact' && request.method === 'POST') {
      return handleContact(request, env);
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
      "SELECT domain FROM blocked_domains WHERE ?1 = domain OR ?1 LIKE '%.' || domain LIMIT 1"
    ).bind(domain).first<{ domain: string }>();
    if (blocked) {
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

    // 顧客作成 + APIキー発行（ハッシュのみ保存）
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
        return json(env, 409, { alreadyRegistered: true });
      }
      return json(env, 500, { error: '登録処理に失敗しました。時間をおいて再度お試しください。' });
    }

    return json(env, 201, { apiKey });
  },
};
