/**
 * WebMCPツール利用イベント記録
 *
 * フロント（src/webmcp/）のツール実行時に送られる軽量イベントを webmcp_logs に記録する。
 * 「誰が・どのツールを・いつ」だけを持ち、工程表データは一切受け取らない。
 * 将来の有料課金時はこのログを customer_id × 月で集計して課金判定に使う。
 */

import { json, type Env } from './index';

/** コンスケが公開するWebMCPツール名（src/webmcp/tools.ts と対応） */
export const WEBMCP_TOOL_NAMES: readonly string[] = [
  'get_schedule',
  'get_activity',
  'shift_activity',
  'update_activity_duration',
  'validate_schedule',
  'get_activities_on_date',
  'find_activities',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type WebmcpEventValidation = 'ok' | 'invalid_tool' | 'invalid_customer';

export function validateWebmcpEvent(tool: string, customerId: string): WebmcpEventValidation {
  if (!WEBMCP_TOOL_NAMES.includes(tool)) return 'invalid_tool';
  if (customerId && !UUID_RE.test(customerId)) return 'invalid_customer';
  return 'ok';
}

export interface WebmcpLogRow {
  id: string;
  customer_id: string | null;
  tool: string;
  ip: string;
  created_at: string;
}

export function buildWebmcpLogRow(
  tool: string,
  customerId: string,
  ip: string,
  now: string
): WebmcpLogRow {
  return {
    id: crypto.randomUUID(),
    customer_id: customerId || null,
    tool,
    ip,
    created_at: now,
  };
}

/** POST /api/webmcp-event */
export async function handleWebmcpEvent(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  let body: { tool?: string };
  try {
    body = await request.json();
  } catch {
    return json(env, 400, { error: 'リクエスト形式が不正です。' });
  }

  const tool = (body.tool ?? '').trim();
  const customerId = (request.headers.get('X-Consche-Id') ?? '').trim();

  const validation = validateWebmcpEvent(tool, customerId);
  if (validation !== 'ok') {
    return json(env, 400, { error: validation });
  }

  const row = buildWebmcpLogRow(
    tool,
    customerId,
    request.headers.get('CF-Connecting-IP') ?? 'unknown',
    new Date().toISOString()
  );
  ctx.waitUntil(
    env.DB.prepare(
      'INSERT INTO webmcp_logs (id, customer_id, tool, ip, created_at) VALUES (?1, ?2, ?3, ?4, ?5)'
    )
      .bind(row.id, row.customer_id, row.tool, row.ip, row.created_at)
      .run()
      .catch(() => {})
  );
  return json(env, 200, {});
}
