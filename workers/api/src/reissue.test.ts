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
import {
  validateReissueToken,
  buildReissueUrl,
  canIssueReissueToken,
  buildReissueEmailText,
  REISSUE_TTL_HOURS,
  type ReissueTokenRow,
} from './reissue';

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

describe('canIssueReissueToken（セルフサービス発行のスパム抑制）', () => {
  it('アクティブなトークンが上限(3)未満なら発行できる', () => {
    expect(canIssueReissueToken(0)).toBe(true);
    expect(canIssueReissueToken(2)).toBe(true);
  });

  it('アクティブなトークンが3件以上なら発行しない', () => {
    expect(canIssueReissueToken(3)).toBe(false);
    expect(canIssueReissueToken(10)).toBe(false);
  });
});

describe('buildReissueEmailText', () => {
  const text = buildReissueEmailText('石川様テスト', 'https://example.com/reissue-code/?token=abc');

  it('宛名とリンクを含む', () => {
    expect(text).toContain('石川様テスト');
    expect(text).toContain('https://example.com/reissue-code/?token=abc');
  });

  it('1回きり・24時間の注意書きを含む', () => {
    expect(text).toContain('1回');
    expect(text).toContain('24時間');
  });

  it('心当たりがない場合の案内を含む（勝手に依頼された場合、開かなければ何も起きない）', () => {
    expect(text).toContain('心当たり');
  });

  it('接続コードの平文は含まない（cs_live_ で始まる実コードが無い）', () => {
    expect(text).not.toMatch(/cs_live_[0-9a-f]{48}/);
  });
});
