/**
 * 案内メールのワンクリック配信停止リンク
 * リンク形式: {base}/api/unsubscribe?e={email}&sig={HMAC-SHA256(email, UNSUB_SECRET)}
 * 署名により本人のリンク以外では解除できない（第三者による嫌がらせ解除の防止）
 */
import { safeEqual } from './adminAuth';

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function unsubSignature(email: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(email.toLowerCase()));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyUnsubSignature(email: string, sig: string, secret: string): Promise<boolean> {
  const expected = await unsubSignature(email, secret);
  return safeEqual(sig, expected);
}

export function buildUnsubUrl(base: string, email: string, sig: string): string {
  return `${base}/api/unsubscribe?e=${encodeURIComponent(email)}&sig=${sig}`;
}
