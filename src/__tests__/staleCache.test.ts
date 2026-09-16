/**
 * 古いキャッシュの一掃の仕様テスト
 *
 * 2026-09-16、利用者から「リンクをクリックするとエラーが出る」という連絡があり、
 * 画面には Failed to fetch dynamically imported module が出ていた。
 * 端末に残った古いHTMLが、すでに入れ替わったJSを読みにいって失敗する状態。
 *
 * このとき自動リロードは走るが、当時の実装はService Workerの update() を呼ぶだけで
 * キャッシュを消していなかった（コメントには「キャッシュを一掃してから」と書いてあった）。
 * update() はSWスクリプトを取り直すだけなので、保存済みの古いファイルはそのまま残り、
 * リロードしても同じものを掴み続ける。
 *
 * 仕様:
 * - clearSiteCaches はキャッシュを全部消し、Service Workerを全部解除する
 * - 片方が例外を投げても、もう片方は必ず実行する（半端に残すと復旧しないため）
 * - caches や serviceWorker が無い環境でも例外を投げない
 *   （復旧処理が落ちると、利用者は白い画面から永久に出られなくなる）
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { clearSiteCaches } from '@/lib/staleCache';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubCaches(keys: string[], onDelete = vi.fn().mockResolvedValue(true)) {
  vi.stubGlobal('caches', {
    keys: vi.fn().mockResolvedValue(keys),
    delete: onDelete,
  });
  return onDelete;
}

function stubServiceWorker(count: number) {
  const unregister = vi.fn().mockResolvedValue(true);
  const regs = Array.from({ length: count }, () => ({ unregister }));
  vi.stubGlobal('navigator', {
    serviceWorker: { getRegistrations: vi.fn().mockResolvedValue(regs) },
  });
  return unregister;
}

describe('clearSiteCaches', () => {
  it('保存されているキャッシュを全部消す', async () => {
    const del = stubCaches(['workbox-precache-v2', 'static-cache', 'api-cache']);
    stubServiceWorker(0);
    await clearSiteCaches();
    expect(del).toHaveBeenCalledTimes(3);
    expect(del).toHaveBeenCalledWith('workbox-precache-v2');
    expect(del).toHaveBeenCalledWith('static-cache');
    expect(del).toHaveBeenCalledWith('api-cache');
  });

  it('Service Workerを全部解除する', async () => {
    stubCaches([]);
    const unregister = stubServiceWorker(2);
    await clearSiteCaches();
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it('キャッシュの削除が失敗しても Service Worker の解除は行う', async () => {
    stubCaches(['x'], vi.fn().mockRejectedValue(new Error('denied')));
    const unregister = stubServiceWorker(1);
    await expect(clearSiteCaches()).resolves.toBeUndefined();
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('Service Workerの解除が失敗してもキャッシュは消す', async () => {
    const del = stubCaches(['x']);
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    await expect(clearSiteCaches()).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('caches も serviceWorker も無い環境で例外を投げない', async () => {
    vi.stubGlobal('caches', undefined);
    vi.stubGlobal('navigator', {});
    await expect(clearSiteCaches()).resolves.toBeUndefined();
  });
});
