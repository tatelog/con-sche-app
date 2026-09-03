/**
 * CORS ヘッダーの仕様テスト
 *
 * 仕様:
 * - フロントが送るカスタムヘッダーは、すべて Access-Control-Allow-Headers に載っていること。
 *   1つでも欠けるとブラウザがプリフライトで弾き、本体のリクエストが飛ばない。
 *   （実際 X-Consche-* の3つが抜けていて、アクティブ計測とWebMCP利用ログが
 *     サーバーに届いていなかった）
 * - Worker 側が実際に読んでいるヘッダー:
 *     handleActivePing   … X-Consche-Id / X-Consche-Email / X-Consche-Anon
 *     handleWebmcpEvent  … X-Consche-Id
 * - ヘッダー名の照合は大文字小文字を区別しない（HTTPの仕様）
 */
import { describe, it, expect } from 'vitest';
import { corsHeaders } from './index';

const env = { ALLOWED_ORIGIN: 'https://con-sche.com' } as Parameters<typeof corsHeaders>[0];

/** フロントが送るカスタムヘッダー。増えたらここに足す */
const SENT_BY_FRONTEND = ['X-Consche-Id', 'X-Consche-Email', 'X-Consche-Anon'];

function allowedHeaderSet(): Set<string> {
  const raw = corsHeaders(env)['Access-Control-Allow-Headers'] ?? '';
  return new Set(raw.split(',').map((h) => h.trim().toLowerCase()));
}

describe('corsHeaders', () => {
  it('フロントが送るカスタムヘッダーをすべて許可している', () => {
    const allowed = allowedHeaderSet();
    const missing = SENT_BY_FRONTEND.filter((h) => !allowed.has(h.toLowerCase()));
    expect(missing).toEqual([]);
  });

  it('Content-Type と Authorization も引き続き許可している', () => {
    const allowed = allowedHeaderSet();
    expect(allowed.has('content-type')).toBe(true);
    expect(allowed.has('authorization')).toBe(true);
  });

  it('プリフライトで使うメソッドを許可している', () => {
    const methods = corsHeaders(env)['Access-Control-Allow-Methods'] ?? '';
    expect(methods).toContain('POST');
    expect(methods).toContain('OPTIONS');
  });

  it('ALLOWED_ORIGIN が設定されていればそれを返す', () => {
    expect(corsHeaders(env)['Access-Control-Allow-Origin']).toBe('https://con-sche.com');
  });
});
