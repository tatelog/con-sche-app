/**
 * 登録時に拒否するメールドメイン一覧
 * フリーメール・携帯キャリアのアドレスを拒否し、会社ドメインでの登録を求める。
 * workers/api/src/index.ts にも同じリストがあるため、変更時は両方更新すること。
 */
export const BLOCKED_DOMAINS = [
  // フリーメール
  'gmail.com',
  'googlemail.com',
  'yahoo.co.jp',
  'yahoo.com',
  'ymail.ne.jp',
  'hotmail.com',
  'hotmail.co.jp',
  'outlook.com',
  'outlook.jp',
  'live.jp',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'gmx.com',
  'mail.com',
  // 携帯キャリア
  'docomo.ne.jp',
  'ezweb.ne.jp',
  'au.com',
  'softbank.ne.jp',
  'i.softbank.jp',
  'ymobile.ne.jp',
  'rakuten.jp',
  'rakumail.jp',
  'mineo.jp',
  'uqmobile.jp',
] as const;

export function isBlockedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return true;
  return (BLOCKED_DOMAINS as readonly string[]).includes(domain);
}
