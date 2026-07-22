/**
 * /api/admin/stats の認証ヘルパー
 * トークンは Authorization: Bearer（優先）または ?token= で受け取る。
 * 比較はタイミング攻撃を避けるため全バイトXOR方式で行う。
 */

export function extractToken(authHeader: string | null, url: URL): string {
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return url.searchParams.get('token') ?? '';
}

export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length || ea.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}
