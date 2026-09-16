/**
 * 登録済み照合の仕様テスト
 *
 * 目的:
 * 別の端末でコンスケを開くと、登録済みの人にも毎回「はじめる前に」の登録画面が出る。
 * 登録はlocalStorageで覚えているだけなので、端末が変われば分からない。
 * 会社のPCで登録した人が、現場のタブレットで開くたびに氏名と会社名を打ち直している。
 * メールアドレスだけで「登録済み」を確かめて、そのまま使えるようにする。
 *
 * 仕様:
 * - 正規化 normalizeLookupEmail:
 *   - 前後の空白を落とし、小文字に揃える（登録時も小文字で保存しているため）
 *   - 形式が不正なものは null（DBに問い合わせるまでもない）
 *   - 空・非文字列も null
 *   - 254文字を超えるものは受け付けない（DBのカラム上限と揃える）
 * - 応答の組み立て buildLookupResponse:
 *   - 見つかった: { found: true, customerId } を返す
 *   - 見つからない: { found: false } のみ。理由や候補は返さない
 *   - APIキーは絶対に含めない。キーの再発行は確認メールを挟む既存の経路に任せる
 *   - 削除済み（deleted_at あり）の顧客は「見つからない」として扱う
 */
import { describe, it, expect } from 'vitest';
import { normalizeLookupEmail, buildLookupResponse, LOOKUP_RATE_LIMIT_PER_HOUR } from './lookup';

describe('normalizeLookupEmail', () => {
  it('前後の空白を落として小文字に揃える', () => {
    expect(normalizeLookupEmail('  Taro@Example.co.JP  ')).toBe('taro@example.co.jp');
  });

  it('正しい形式はそのまま通る', () => {
    expect(normalizeLookupEmail('taro@example.co.jp')).toBe('taro@example.co.jp');
  });

  it('形式が不正なものは null', () => {
    expect(normalizeLookupEmail('taro')).toBeNull();
    expect(normalizeLookupEmail('taro@')).toBeNull();
    expect(normalizeLookupEmail('@example.com')).toBeNull();
    expect(normalizeLookupEmail('taro@example')).toBeNull();
    expect(normalizeLookupEmail('taro @example.com')).toBeNull();
  });

  it('空・非文字列は null', () => {
    expect(normalizeLookupEmail('')).toBeNull();
    expect(normalizeLookupEmail('   ')).toBeNull();
    expect(normalizeLookupEmail(null)).toBeNull();
    expect(normalizeLookupEmail(undefined)).toBeNull();
    expect(normalizeLookupEmail(42)).toBeNull();
  });

  it('長すぎるアドレスは受け付けない', () => {
    const long = 'a'.repeat(250) + '@example.com';
    expect(normalizeLookupEmail(long)).toBeNull();
  });
});

describe('buildLookupResponse', () => {
  const customer = { id: 'c-123', deleted_at: null };

  it('見つかったら found: true と customerId を返す', () => {
    expect(buildLookupResponse(customer)).toEqual({ found: true, customerId: 'c-123' });
  });

  it('見つからなければ found: false だけを返す', () => {
    expect(buildLookupResponse(null)).toEqual({ found: false });
  });

  it('削除済みの顧客は見つからない扱い', () => {
    expect(buildLookupResponse({ id: 'c-999', deleted_at: '2026-09-01T00:00:00Z' })).toEqual({
      found: false,
    });
  });

  it('APIキーらしきものを一切含まない', () => {
    const res = JSON.stringify(buildLookupResponse(customer));
    expect(res).not.toContain('cs_live_');
    expect(res).not.toMatch(/apiKey/i);
    expect(res).not.toMatch(/email/i);
  });
});

describe('LOOKUP_RATE_LIMIT_PER_HOUR', () => {
  it('総当たりでアドレスの存在を調べられない程度に絞ってある', () => {
    // 「登録済みかどうか」が分かるだけでも名簿の当たり判定に使える。
    // 正規の利用（別端末で1回入れ直す）に足りて、総当たりには足りない値にする
    expect(LOOKUP_RATE_LIMIT_PER_HOUR).toBeLessThanOrEqual(10);
    expect(LOOKUP_RATE_LIMIT_PER_HOUR).toBeGreaterThanOrEqual(3);
  });
});
