/**
 * 会社名による登録ブロックの仕様テスト
 *
 * 仕様（実装前に言語化したもの）:
 * - blocked_companies のキーワードが会社名に含まれていたら、その行を返す
 * - 照合は大文字小文字を区別しない（Zephyr / zephyr / ZEPHYR すべて同じ）
 * - 部分一致。前後に何が付いていてもマッチする
 *   （「株式会社Zephyr」「Zephyr株式会社」「株式会社 Zephyr 東京支店」）
 * - どのキーワードにも当たらなければ null を返す
 * - 空文字・空白のみのキーワードは無視する（全件ブロックの事故を防ぐ）
 * - 会社名が空なら null を返す
 * - 複数当たる場合は最初に当たった行を返す
 *
 * 背景: ドメインだけ見ていたため、ブロック済みの会社に別ドメインから
 * 登録された（2026-10-04 判明）。会社名でも網をかける。
 *
 * ここに出てくる会社名は、公開リポジトリに実在の社名を残さないための
 * 架空の例。実際のキーワードは D1 の blocked_companies にだけ置く。
 */
import { describe, it, expect } from 'vitest';
import { matchBlockedCompany, type BlockedCompanyRow } from './blockedCompany';

const ROWS: BlockedCompanyRow[] = [
  { keyword: 'Zephyr', note: 'Zephyr' },
  { keyword: 'カゲロウ', note: 'カゲロウ' },
  { keyword: 'ミナモ', note: 'ミナモ' },
];

describe('matchBlockedCompany', () => {
  it('キーワードを含む会社名はブロック対象として返る', () => {
    const hit = matchBlockedCompany('株式会社Zephyr', ROWS);
    expect(hit?.keyword).toBe('Zephyr');
  });

  it('大文字小文字を区別しない', () => {
    expect(matchBlockedCompany('株式会社ZEPHYR', ROWS)?.keyword).toBe('Zephyr');
    expect(matchBlockedCompany('zephyr inc.', ROWS)?.keyword).toBe('Zephyr');
  });

  it('前後に文字が付いていても部分一致する', () => {
    expect(matchBlockedCompany('Zephyr株式会社', ROWS)?.keyword).toBe('Zephyr');
    expect(matchBlockedCompany('株式会社 Zephyr 東京支店', ROWS)?.keyword).toBe('Zephyr');
  });

  it('日本語のキーワードも一致する', () => {
    expect(matchBlockedCompany('株式会社カゲロウ', ROWS)?.keyword).toBe('カゲロウ');
    expect(matchBlockedCompany('ミナモ', ROWS)?.keyword).toBe('ミナモ');
  });

  it('どのキーワードにも当たらなければ null', () => {
    expect(matchBlockedCompany('株式会社やまだ工務店', ROWS)).toBeNull();
    expect(matchBlockedCompany('みどり建設', ROWS)).toBeNull();
    expect(matchBlockedCompany('建ログ', ROWS)).toBeNull();
  });

  it('会社名が空なら null', () => {
    expect(matchBlockedCompany('', ROWS)).toBeNull();
    expect(matchBlockedCompany('   ', ROWS)).toBeNull();
  });

  it('空文字・空白のみのキーワードは無視する（全件ブロックの事故を防ぐ）', () => {
    const rows: BlockedCompanyRow[] = [
      { keyword: '', note: '空' },
      { keyword: '   ', note: '空白' },
    ];
    expect(matchBlockedCompany('株式会社建ログ', rows)).toBeNull();
  });

  it('キーワードの前後の空白は無視して照合する', () => {
    const rows: BlockedCompanyRow[] = [{ keyword: '  Zephyr  ', note: 'Zephyr' }];
    expect(matchBlockedCompany('株式会社Zephyr', rows)?.note).toBe('Zephyr');
  });

  it('複数当たる場合は最初に当たった行を返す', () => {
    const rows: BlockedCompanyRow[] = [
      { keyword: 'Zephyr', note: '先' },
      { keyword: 'phyr', note: '後' },
    ];
    expect(matchBlockedCompany('株式会社Zephyr', rows)?.note).toBe('先');
  });

  it('リストが空なら null', () => {
    expect(matchBlockedCompany('株式会社Zephyr', [])).toBeNull();
  });
});
