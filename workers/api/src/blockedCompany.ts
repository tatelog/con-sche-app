/**
 * 会社名による登録ブロック
 *
 * ドメインのブロック（blocked_domains）だけでは、同じ会社が別ドメインで
 * 登録してきたときに素通りしてしまう。実際、ブロック済みのドメインを持つ
 * 会社から、別ドメインで登録されたことがある（2026-10-04 判明）。
 * その二重の網として、会社名でも照合する。
 *
 * 対象のキーワードはコードに持たず、D1 の blocked_companies にだけ置く。
 */

export type BlockedCompanyRow = {
  keyword: string;
  note: string | null;
};

/**
 * 登録フォームの会社名が、ブロック対象のキーワードを含むかどうかを判定する。
 *
 * - 照合は大文字小文字を区別しない
 * - 部分一致（「株式会社○○」「○○株式会社」どちらもマッチ）
 * - 空白のみ・空文字のキーワードは無視する（誤爆防止）
 * - 最初にマッチした行を返す。無ければ null
 */
export function matchBlockedCompany(
  company: string,
  rows: BlockedCompanyRow[]
): BlockedCompanyRow | null {
  const target = (company ?? '').toLowerCase();
  if (!target.trim()) return null;

  for (const row of rows) {
    const kw = (row?.keyword ?? '').trim().toLowerCase();
    if (!kw) continue;
    if (target.includes(kw)) return row;
  }
  return null;
}
