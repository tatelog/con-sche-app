/**
 * 接続コード再発行（ワンタイムリンク方式）
 *
 * 流れ:
 * 1. 利用者が contact@tatelog.biz に再発行を依頼
 * 2. 管理者が POST /api/admin/reissue { email } でワンタイムリンクを発行（要 ADMIN_STATS_TOKEN）
 * 3. 利用者にリンクをメールで送る（コード自体はメールに載せない）
 * 4. 利用者がリンクを開く → POST /api/reissue/redeem { token } → 新コードを1回だけ表示
 *    このとき旧キーはすべて suspended にする（紛失キーの悪用防止）
 *
 * トークンは24時間有効・1回きり。使用済み/期限切れは再利用不可。
 */

export const REISSUE_TTL_HOURS = 24;

export interface ReissueTokenRow {
  token: string;
  customer_id: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

export type ReissueValidation = 'ok' | 'not_found' | 'used' | 'expired';

/** トークン行の状態を判定する（期限ちょうどは expired 扱い） */
export function validateReissueToken(row: ReissueTokenRow | null, nowIso: string): ReissueValidation {
  if (!row) return 'not_found';
  if (row.used_at) return 'used';
  if (row.expires_at <= nowIso) return 'expired';
  return 'ok';
}

/** ワンタイム表示ページのURLを組み立てる */
export function buildReissueUrl(docsBase: string, token: string): string {
  return `${docsBase.replace(/\/+$/, '')}/reissue-code/?token=${token}`;
}
