/**
 * 登録済みの照合（別の端末から入り直すため）
 *
 * 登録したかどうかは端末のlocalStorageで覚えているだけなので、端末が変わると
 * 登録済みの人にも毎回「はじめる前に」の画面が出る。会社のPCで登録した人が
 * 現場のタブレットで開くたびに氏名と会社名を打ち直している状態だった。
 *
 * メールアドレスだけで登録の有無を確かめて、登録済みならそのまま使えるようにする。
 *
 * 返すのは「登録があるか」と customers.id だけ。APIキーは絶対に返さない。
 * キーの再発行は確認メールを挟む /api/reissue に任せる（メールを知っているだけの
 * 第三者にキーが渡らないようにするため）。
 */

import { json, type Env } from './index';

/** 同一IPからの照合回数の上限。総当たりで名簿の当たり判定をされないように絞る */
export const LOOKUP_RATE_LIMIT_PER_HOUR = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;

/** 照合に使える形に整える。使えないものは null */
export function normalizeLookupEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

export interface LookupCustomer {
  id: string;
  deleted_at: string | null;
}

export type LookupResponse = { found: true; customerId: string } | { found: false };

/** 応答を組み立てる。見つからない場合は理由を返さない（存在の手がかりを与えない） */
export function buildLookupResponse(customer: LookupCustomer | null): LookupResponse {
  if (!customer || customer.deleted_at) return { found: false };
  return { found: true, customerId: customer.id };
}

/** POST /api/lookup { email } */
export async function handleLookup(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(env, 400, { error: 'リクエスト形式が不正です。' });
  }

  const email = normalizeLookupEmail(body.email);
  if (!email) {
    return json(env, 400, { error: 'メールアドレスの形式が正しくありません。' });
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const now = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM lookup_attempts WHERE ip = ?1 AND created_at > ?2'
  )
    .bind(ip, oneHourAgo)
    .first<{ cnt: number }>();
  if ((recent?.cnt ?? 0) >= LOOKUP_RATE_LIMIT_PER_HOUR) {
    return json(env, 429, {
      error: '確認の回数が上限に達しました。しばらく時間をおいてお試しください。',
    });
  }

  const customer = await env.DB.prepare(
    'SELECT id, deleted_at FROM customers WHERE email = ?1 LIMIT 1'
  )
    .bind(email)
    .first<LookupCustomer>();

  const result = buildLookupResponse(customer ?? null);

  // 試行の記録は応答をブロックしない。見つかったかどうかも残して、
  // 「登録済みなのに入れない」という問い合わせが来たときに追えるようにする
  ctx.waitUntil(
    env.DB.prepare(
      'INSERT INTO lookup_attempts (id, ip, found, created_at) VALUES (?1, ?2, ?3, ?4)'
    )
      .bind(crypto.randomUUID(), ip, result.found ? 1 : 0, now)
      .run()
      .catch(() => {})
  );

  // 見つかった場合だけ、最終利用の記録も更新しておく（別端末からの復帰も利用として数える）
  if (result.found) {
    ctx.waitUntil(
      env.DB.prepare('UPDATE customers SET last_seen_at = ?1 WHERE id = ?2')
        .bind(now, result.customerId)
        .run()
        .catch(() => {})
    );
  }

  return json(env, 200, result);
}
