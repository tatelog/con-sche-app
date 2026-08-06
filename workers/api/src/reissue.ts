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

/** セルフサービス発行のスパム抑制: アクティブな（未使用・期限内）トークンが上限未満のときだけ発行する */
export const REISSUE_MAX_ACTIVE_TOKENS = 3;

export function canIssueReissueToken(activeCount: number): boolean {
  return activeCount < REISSUE_MAX_ACTIVE_TOKENS;
}

/** 再発行リンクの自動送信メール本文（コードの平文は絶対に載せない） */
export function buildReissueEmailText(name: string, url: string): string {
  return [
    `${name} 様`,
    '',
    'Con-Sche（コンスケ）の接続コード再発行のご依頼を受け付けました。',
    `以下のリンクを開くと、新しい接続コードが1回だけ表示されます（有効期限: ${REISSUE_TTL_HOURS}時間）。`,
    '',
    url,
    '',
    '※表示されたコードは必ずコピーして、安全な場所に保管してください。',
    '※新しいコードが発行されると、これまでのコードは無効になります。',
    '※心当たりがない場合は、このメールを無視してください（リンクを開かない限り何も起こりません）。',
    '',
    '--',
    '株式会社建ログ / Con-Sche',
  ].join('\n');
}
