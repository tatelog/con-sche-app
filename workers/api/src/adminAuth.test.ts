/**
 * /api/admin/stats の認証ロジックの仕様テスト
 * - トークンはAuthorization: Bearer または ?token= で受け取る（Bearer優先）
 * - 比較は一致/不一致を正しく判定し、長さが違っても例外を出さない
 * - 空文字トークンは常に不一致
 */
import { describe, it, expect } from 'vitest';
import { extractToken, safeEqual } from './adminAuth';

describe('extractToken', () => {
  it('Authorization: Bearer からトークンを取り出す', () => {
    const url = new URL('https://api.example.com/api/admin/stats');
    expect(extractToken('Bearer abc123', url)).toBe('abc123');
  });

  it('クエリ ?token= からも取り出せる', () => {
    const url = new URL('https://api.example.com/api/admin/stats?token=qp456');
    expect(extractToken(null, url)).toBe('qp456');
  });

  it('Bearerとクエリが両方あればBearer優先', () => {
    const url = new URL('https://api.example.com/api/admin/stats?token=qp456');
    expect(extractToken('Bearer abc123', url)).toBe('abc123');
  });

  it('どちらも無ければ空文字', () => {
    const url = new URL('https://api.example.com/api/admin/stats');
    expect(extractToken(null, url)).toBe('');
    expect(extractToken('Basic xxx', url)).toBe('');
  });
});

describe('safeEqual', () => {
  it('一致でtrue', () => {
    expect(safeEqual('secret-token', 'secret-token')).toBe(true);
  });

  it('不一致でfalse（長さ違いも例外なし）', () => {
    expect(safeEqual('secret-token', 'secret-tokeN')).toBe(false);
    expect(safeEqual('short', 'longer-token')).toBe(false);
  });

  it('空文字は設定済みトークンと一致しない', () => {
    expect(safeEqual('', 'secret-token')).toBe(false);
  });
});
