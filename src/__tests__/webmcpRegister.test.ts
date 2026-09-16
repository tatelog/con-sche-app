/**
 * WebMCPツール登録の接続先の仕様テスト
 *
 * 2026-09-16、実験機能を有効にしたChromeで実際に確かめたところ、
 * ブラウザが用意するのは navigator.modelContext だった（document.modelContext は無い）。
 * 一方このアプリは document.modelContext だけを見ていたため、
 * フラグを立てた環境でもツールが1つも登録されていなかった。
 *
 * W3Cの仕様は navigator.modelContext、document.modelContext は一部のポリフィルが使う形。
 * どちらの環境でも動くよう、両方を見る。
 *
 * 仕様:
 * - navigator.modelContext があればそれを使う（標準）
 * - 無ければ document.modelContext を使う（ポリフィル環境）
 * - 両方あれば navigator を優先する
 * - どちらも無ければ null（未対応環境では何もしない）
 * - registerTool を持たないものは使えないので null 扱いにする
 */
import { describe, it, expect } from 'vitest';
import { resolveModelContext } from '@/webmcp/register';

const usable = { registerTool: () => undefined };

describe('resolveModelContext', () => {
  it('navigator 側があればそれを返す（W3C標準の形）', () => {
    expect(resolveModelContext(usable, undefined)).toBe(usable);
  });

  it('navigator 側が無ければ document 側を返す（ポリフィル環境）', () => {
    expect(resolveModelContext(undefined, usable)).toBe(usable);
  });

  it('両方あれば navigator を優先する', () => {
    const fromNavigator = { registerTool: () => undefined };
    const fromDocument = { registerTool: () => undefined };
    expect(resolveModelContext(fromNavigator, fromDocument)).toBe(fromNavigator);
  });

  it('どちらも無ければ null', () => {
    expect(resolveModelContext(undefined, undefined)).toBeNull();
  });

  it('registerTool を持たないものは使えないので無視する', () => {
    const broken = {} as { registerTool?: unknown };
    expect(resolveModelContext(broken, undefined)).toBeNull();
    expect(resolveModelContext(broken, usable)).toBe(usable);
  });
});
