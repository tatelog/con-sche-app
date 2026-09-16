/**
 * バージョン確認と自動リロードの仕様テスト
 *
 * デプロイしても、端末に古いHTMLが残っていると新しい版に気づけない。
 * 2026-09-16、利用者の端末で「もう存在しないファイルを読みにいって失敗する」状態が起きた。
 * 起動のたびにサーバー上の最新版を確認し、食い違っていれば読み直す。
 *
 * 仕様:
 * - compareBuild(いま動いている版, サーバーの最新版):
 *   - 同じ → 'same'
 *   - 違う → 'outdated'
 *   - どちらかが空・取得できなかった → 'unknown'（判断材料が無いときは何もしない）
 * - shouldReload(判定, すでに試したか):
 *   - 'outdated' かつ未試行 → true
 *   - 'outdated' だが試行済み → false（リロードを繰り返して永久に開けなくなるのを防ぐ）
 *   - 'same' / 'unknown' → false
 *
 * 判断に迷ったら「リロードしない」に倒す。
 * 誤ってリロードすると、編集中の利用者の手を止めてしまうため。
 */
import { describe, it, expect } from 'vitest';
import { compareBuild, shouldReload } from '@/lib/versionCheck';

describe('compareBuild', () => {
  it('同じビルドなら same', () => {
    expect(compareBuild('2026-09-16 07:20', '2026-09-16 07:20')).toBe('same');
  });

  it('違うビルドなら outdated', () => {
    expect(compareBuild('2026-09-16 07:20', '2026-09-16 09:45')).toBe('outdated');
  });

  it('前後の空白は無視して比べる', () => {
    expect(compareBuild(' 2026-09-16 07:20 ', '2026-09-16 07:20')).toBe('same');
  });

  it('どちらかが空なら unknown', () => {
    expect(compareBuild('', '2026-09-16 09:45')).toBe('unknown');
    expect(compareBuild('2026-09-16 07:20', '')).toBe('unknown');
    expect(compareBuild('', '')).toBe('unknown');
  });

  it('文字列でないものは unknown', () => {
    expect(compareBuild(undefined as unknown as string, '2026-09-16 09:45')).toBe('unknown');
    expect(compareBuild('2026-09-16 07:20', null as unknown as string)).toBe('unknown');
  });
});

describe('shouldReload', () => {
  it('古い版で、まだ試していなければリロードする', () => {
    expect(shouldReload('outdated', false)).toBe(true);
  });

  it('古い版でも、一度試していればリロードしない', () => {
    // 読み直しても解消しない状況で繰り返すと、永久に画面が開かなくなる
    expect(shouldReload('outdated', true)).toBe(false);
  });

  it('同じ版ならリロードしない', () => {
    expect(shouldReload('same', false)).toBe(false);
    expect(shouldReload('same', true)).toBe(false);
  });

  it('判断できないときはリロードしない', () => {
    expect(shouldReload('unknown', false)).toBe(false);
    expect(shouldReload('unknown', true)).toBe(false);
  });
});
