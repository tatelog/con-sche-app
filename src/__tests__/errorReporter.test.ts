/**
 * エラー報告の仕様テスト
 *
 * 目的:
 * ブラウザ側で起きた例外を、ユーザーに何か操作してもらわなくてもサーバーに届ける。
 * ただし「報告そのものが新たな負荷や事故になる」ことは絶対に避ける。
 *
 * 仕様:
 * - describeError: 投げられたものが何であれ message と stack を取り出す
 *   - Error → message と stack
 *   - 文字列 → それ自体が message、stack は空
 *   - message を持つオブジェクト → その message
 *   - null / undefined / 数値など → 'Unknown error'
 *   - message は空文字にならない（サーバーが missing_message で捨てるため）
 * - isIgnorable: 実害がなく件数だけ膨らむ既知のノイズは送らない
 *   - ResizeObserver のループ警告は無視する
 *   - 通常のエラーは無視しない
 * - shouldReport: 同じセッションで同じエラーを何度も送らない
 *   - 同じキーは1回だけ true
 *   - 違うキーは別扱い
 *   - 1セッションの上限（MAX_REPORTS_PER_SESSION）を超えたら false
 *     （エラーループに陥った端末が延々と送り続けるのを止める）
 */
import { describe, it, expect } from 'vitest';
import {
  describeError,
  isIgnorable,
  shouldReport,
  createReportState,
  MAX_REPORTS_PER_SESSION,
} from '@/lib/errorReporter';

describe('describeError', () => {
  it('Error から message と stack を取り出す', () => {
    const err = new Error('boom');
    const d = describeError(err);
    expect(d.message).toBe('boom');
    expect(d.stack).toContain('boom');
  });

  it('文字列はそれ自体を message にする', () => {
    const d = describeError('something went wrong');
    expect(d.message).toBe('something went wrong');
    expect(d.stack).toBe('');
  });

  it('message を持つオブジェクトからは message を取る', () => {
    expect(describeError({ message: 'from object' }).message).toBe('from object');
  });

  it('null / undefined / 数値は Unknown error になる', () => {
    expect(describeError(null).message).toBe('Unknown error');
    expect(describeError(undefined).message).toBe('Unknown error');
    expect(describeError(123).message).toBe('Unknown error');
  });

  it('空文字の message も Unknown error に置き換える', () => {
    expect(describeError(new Error('')).message).toBe('Unknown error');
    expect(describeError('   ').message).toBe('Unknown error');
  });
});

describe('isIgnorable', () => {
  it('ResizeObserver のループ警告は無視する', () => {
    expect(isIgnorable('ResizeObserver loop limit exceeded')).toBe(true);
    expect(isIgnorable('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
  });

  it('通常のエラーは無視しない', () => {
    expect(isIgnorable('Failed to fetch')).toBe(false);
    expect(isIgnorable('Cannot read properties of undefined')).toBe(false);
  });
});

describe('shouldReport', () => {
  it('同じキーは最初の1回だけ通す', () => {
    const state = createReportState();
    expect(shouldReport('a', state)).toBe(true);
    expect(shouldReport('a', state)).toBe(false);
    expect(shouldReport('a', state)).toBe(false);
  });

  it('違うキーはそれぞれ1回通す', () => {
    const state = createReportState();
    expect(shouldReport('a', state)).toBe(true);
    expect(shouldReport('b', state)).toBe(true);
  });

  it('1セッションの上限を超えたら通さない', () => {
    const state = createReportState();
    for (let i = 0; i < MAX_REPORTS_PER_SESSION; i++) {
      expect(shouldReport(`key-${i}`, state)).toBe(true);
    }
    expect(shouldReport('one-more', state)).toBe(false);
  });
});
