/**
 * 接続コード再発行（ワンタイムリンク）の仕様テスト
 *
 * 仕様:
 * - 管理者が発行したトークンは24時間有効・1回だけ使える
 * - validateReissueToken は reissue_tokens の行を検証して結果を返す:
 *   - 行が無い          → 'not_found'
 *   - used_at が非NULL  → 'used'（使用済みリンクは二度と使えない）
 *   - expires_at が過去 → 'expired'
 *   - それ以外          → 'ok'
 * - buildReissueUrl はワンタイムページのURLを組み立てる（token をクエリに載せる）
 */
import { describe, it, expect } from 'vitest';
import { validateReissueToken, buildReissueUrl, REISSUE_TTL_HOURS, type ReissueTokenRow } from './reissue';

const NOW = '2026-08-06T12:00:00.000Z';

function row(overrides: Partial<ReissueTokenRow> = {}): ReissueTokenRow {
  return {
    token: 'a'.repeat(64),
    customer_id: 'cust-1',
    created_at: '2026-08-06T10:00:00.000Z',
    expires_at: '2026-08-07T10:00:00.000Z',
    used_at: null,
    ...overrides,
  };
}

describe('validateReissueToken', () => {
  it('行が無ければ not_found', () => {
    expect(validateReissueToken(null, NOW)).toBe('not_found');
  });

  it('使用済み（used_at 非NULL）は used', () => {
    expect(validateReissueToken(row({ used_at: '2026-08-06T11:00:00.000Z' }), NOW)).toBe('used');
  });

  it('期限切れ（expires_at が現在より過去）は expired', () => {
    expect(validateReissueToken(row({ expires_at: '2026-08-06T11:59:59.000Z' }), NOW)).toBe('expired');
  });

  it('未使用かつ期限内なら ok', () => {
    expect(validateReissueToken(row(), NOW)).toBe('ok');
  });

  it('期限ちょうど（expires_at === now）は expired 扱い', () => {
    expect(validateReissueToken(row({ expires_at: NOW }), NOW)).toBe('expired');
  });
});

describe('buildReissueUrl', () => {
  it('ワンタイムページURLに token を載せる', () => {
    expect(buildReissueUrl('https://con-sche-docs.pages.dev', 'tok123')).toBe(
      'https://con-sche-docs.pages.dev/reissue-code/?token=tok123'
    );
  });

  it('末尾スラッシュがあっても二重にならない', () => {
    expect(buildReissueUrl('https://con-sche-docs.pages.dev/', 'tok123')).toBe(
      'https://con-sche-docs.pages.dev/reissue-code/?token=tok123'
    );
  });
});

describe('REISSUE_TTL_HOURS', () => {
  it('有効期限は24時間', () => {
    expect(REISSUE_TTL_HOURS).toBe(24);
  });
});
