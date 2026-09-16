/**
 * クライアントエラー記録
 *
 * 「エラーが出ます」という問い合わせだけが届いて、何が起きたのか誰も分からない、
 * という状態をなくすための記録。ブラウザ側で起きた例外・Promise拒否・API呼び出し失敗を
 * POST /api/client-error で受け、client_errors に貯めて GET /api/admin/errors で確認する。
 *
 * 工程表の中身は一切受け取らない。受けるのはエラーメッセージ・スタック・
 * ページURL・UA・アプリのビルド・Service Workerの状態まで。
 *
 * 同一の端末 × 同一の指紋 × 同一の時間は1行にまとめ、occurrences を増やすだけにする。
 * エラーループに陥った端末が1台あるだけでD1が埋まるのを防ぐため。
 */

import { json, type Env } from './index';

/** エラーを拾った経路。これ以外は 'unknown' に丸める */
export const CLIENT_ERROR_SOURCES = [
  'window.onerror',
  'unhandledrejection',
  'react',
  'fetch',
  'manual',
  // アプリが起動すらできなかった場合。index.html に直接書いた見張り役から届く。
  // バンドルが404のときは他の経路が全部死ぬので、これが唯一の報告手段になる
  'boot',
] as const;

export type ClientErrorSource = (typeof CLIENT_ERROR_SOURCES)[number] | 'unknown';

const LIMITS = {
  message: 500,
  stack: 2000,
  pageUrl: 500,
  userAgent: 500,
  appVersion: 50,
  swState: 30,
} as const;

export interface NormalizedClientError {
  message: string;
  stack: string;
  source: ClientErrorSource;
  pageUrl: string;
  userAgent: string;
  appVersion: string;
  swState: string;
}

export type ClientErrorNormalizeResult =
  | { ok: true; value: NormalizedClientError }
  | { ok: false; reason: 'missing_message' };

function trimTo(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * 受信した本文を検証して正規化する。
 * message が無いものだけ拒否し、それ以外は丸めてでも受ける。
 * エラー報告は取りこぼすほうが損なので、素性が怪しくても記録する側に倒す。
 */
export function normalizeClientError(input: unknown): ClientErrorNormalizeResult {
  const body = (input ?? {}) as Record<string, unknown>;

  const message = trimTo(body.message, LIMITS.message);
  if (!message) return { ok: false, reason: 'missing_message' };

  const rawSource = typeof body.source === 'string' ? body.source.trim() : '';
  const source = (CLIENT_ERROR_SOURCES as readonly string[]).includes(rawSource)
    ? (rawSource as ClientErrorSource)
    : 'unknown';

  return {
    ok: true,
    value: {
      message,
      stack: trimTo(body.stack, LIMITS.stack),
      source,
      pageUrl: trimTo(body.pageUrl, LIMITS.pageUrl),
      userAgent: trimTo(body.userAgent, LIMITS.userAgent),
      appVersion: trimTo(body.appVersion, LIMITS.appVersion),
      swState: trimTo(body.swState, LIMITS.swState),
    },
  };
}

/**
 * 指紋を取る前にメッセージから「毎回変わるが本質ではない部分」を伏せる。
 * これをやらないと、デプロイのたびにファイル名が変わるチャンク取得失敗が
 * 全部別件として並び、同じ不具合だと気づけない。
 */
function canonicalizeMessage(message: string): string {
  return message
    // URLのクエリ文字列（?t=... のようなキャッシュ避け）
    .replace(/\?[^\s)'"]*/g, '')
    // ビルドごとに変わるアセットのハッシュ（AppPage-leXcEGVB.js → AppPage-#.js）
    .replace(/-[A-Za-z0-9_]{6,}\.(js|mjs|css|map|wasm)\b/g, '-#.$1')
    // 行番号・件数・日時などの数値
    .replace(/\d+/g, '#')
    .trim();
}

function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 同じ不具合を束ねるための指紋（決定的・16桁16進） */
export function errorFingerprint(message: string, source: string): string {
  const key = `${source}|${canonicalizeMessage(message)}`;
  const a = fnv1a(key, 0x811c9dc5);
  const b = fnv1a(key, (0x811c9dc5 ^ 0x9e3779b9) >>> 0);
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** UTCの時間バケツ（YYYY-MM-DDTHH）。同一時間内の連発を1行にまとめるために使う */
export function hourBucket(nowIso: string): string {
  return nowIso.slice(0, 13);
}

export interface ClientErrorRow {
  hour: string;
  fingerprint: string;
  visitor_id: string;
  customer_id: string | null;
  source: string;
  message: string;
  stack: string | null;
  page_url: string | null;
  app_version: string | null;
  sw_state: string | null;
  user_agent: string | null;
  ip: string;
  first_at: string;
  last_at: string;
}

export function buildClientErrorRow(
  normalized: NormalizedClientError,
  customerId: string,
  anonId: string,
  ip: string,
  now: string
): ClientErrorRow {
  return {
    hour: hourBucket(now),
    fingerprint: errorFingerprint(normalized.message, normalized.source),
    visitor_id: customerId || anonId || 'unknown',
    customer_id: customerId || null,
    source: normalized.source,
    message: normalized.message,
    stack: normalized.stack || null,
    page_url: normalized.pageUrl || null,
    app_version: normalized.appVersion || null,
    sw_state: normalized.swState || null,
    user_agent: normalized.userAgent || null,
    ip,
    first_at: now,
    last_at: now,
  };
}

const DEFAULT_DAYS = 7;
const DEFAULT_LIMIT = 50;

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** GET /api/admin/errors のクエリ解釈（範囲外は上下限に収める） */
export function parseErrorQuery(url: URL): { days: number; limit: number } {
  return {
    days: clampInt(url.searchParams.get('days'), DEFAULT_DAYS, 1, 90),
    limit: clampInt(url.searchParams.get('limit'), DEFAULT_LIMIT, 1, 200),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ANON_RE = /^anon-[0-9a-f-]{8,64}$/;

/** POST /api/client-error */
export async function handleClientError(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(env, 400, { error: 'リクエスト形式が不正です。' });
  }

  const result = normalizeClientError(body);
  if (!result.ok) {
    return json(env, 400, { error: result.reason });
  }

  const customerId = (request.headers.get('X-Consche-Id') ?? '').trim();
  const anonId = (request.headers.get('X-Consche-Anon') ?? '').trim();
  const row = buildClientErrorRow(
    result.value,
    UUID_RE.test(customerId) ? customerId : '',
    ANON_RE.test(anonId) ? anonId : '',
    request.headers.get('CF-Connecting-IP') ?? 'unknown',
    new Date().toISOString()
  );

  ctx.waitUntil(
    env.DB.prepare(
      `INSERT INTO client_errors
         (hour, fingerprint, visitor_id, customer_id, source, message, stack,
          page_url, app_version, sw_state, user_agent, ip, occurrences, first_at, last_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 1, ?13, ?13)
       ON CONFLICT(hour, fingerprint, visitor_id) DO UPDATE SET
         occurrences = occurrences + 1,
         last_at = excluded.last_at,
         customer_id = COALESCE(excluded.customer_id, client_errors.customer_id),
         stack = COALESCE(client_errors.stack, excluded.stack)`
    )
      .bind(
        row.hour,
        row.fingerprint,
        row.visitor_id,
        row.customer_id,
        row.source,
        row.message,
        row.stack,
        row.page_url,
        row.app_version,
        row.sw_state,
        row.user_agent,
        row.ip,
        row.first_at
      )
      .run()
      .catch(() => {})
  );

  // 記録の成否にかかわらず 200。エラー報告でさらにエラーを出させない
  return json(env, 200, {});
}

/** GET /api/admin/errors（ADMIN_STATS_TOKEN で保護。認証は呼び出し側で済ませる） */
export async function handleAdminErrors(env: Env, url: URL): Promise<Response> {
  const { days, limit } = parseErrorQuery(url);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const summary = await env.DB.prepare(
    `SELECT fingerprint, source,
            MAX(message) AS message,
            SUM(occurrences) AS occurrences,
            COUNT(DISTINCT visitor_id) AS visitors,
            MIN(first_at) AS first_at,
            MAX(last_at) AS last_at
       FROM client_errors
      WHERE last_at > ?1
      GROUP BY fingerprint, source
      ORDER BY occurrences DESC
      LIMIT ?2`
  )
    .bind(since, limit)
    .all();

  const recent = await env.DB.prepare(
    `SELECT fingerprint, source, message, stack, page_url, app_version, sw_state,
            user_agent, visitor_id, customer_id, occurrences, first_at, last_at
       FROM client_errors
      WHERE last_at > ?1
      ORDER BY last_at DESC
      LIMIT ?2`
  )
    .bind(since, limit)
    .all();

  return json(env, 200, {
    days,
    since,
    summary: summary.results ?? [],
    recent: recent.results ?? [],
  });
}
