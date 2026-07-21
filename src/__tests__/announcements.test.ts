/**
 * お知らせの未読判定（赤ドット表示）の仕様テスト
 * - お知らせが1件も無ければ未読なし
 * - 既読記録が無い端末では、お知らせがあれば未読
 * - 最新お知らせが既読時刻より新しければ未読
 * - 最新お知らせが既読時刻以前なら未読なし
 */
import { describe, it, expect } from 'vitest';
import { hasUnread } from '@/utils/announcements';

describe('hasUnread(最新お知らせ日時, 最終既読日時)', () => {
  it('お知らせが1件も無い場合は false', () => {
    expect(hasUnread(null, null)).toBe(false);
    expect(hasUnread(null, '2026-07-22T00:00:00Z')).toBe(false);
  });

  it('既読記録が無い端末では、お知らせがあれば true', () => {
    expect(hasUnread('2026-07-22T00:00:00Z', null)).toBe(true);
  });

  it('最新お知らせが既読時刻より新しければ true', () => {
    expect(hasUnread('2026-07-22T10:00:00Z', '2026-07-22T09:00:00Z')).toBe(true);
  });

  it('最新お知らせが既読時刻と同じか古ければ false', () => {
    expect(hasUnread('2026-07-22T09:00:00Z', '2026-07-22T09:00:00Z')).toBe(false);
    expect(hasUnread('2026-07-21T00:00:00Z', '2026-07-22T09:00:00Z')).toBe(false);
  });

  it('壊れた日時文字列（localStorage改ざん等）では安全側に倒して false', () => {
    expect(hasUnread('not-a-date', null)).toBe(false);
  });
});
