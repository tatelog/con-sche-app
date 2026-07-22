/**
 * React.lazy のチャンク取得失敗時に1回だけ自動リロードするラッパー
 *
 * PWA環境では「古いSW/HTMLが残った端末 × 新デプロイ」の狭間で
 * "Failed to fetch dynamically imported module" が起きうる。
 * リロードすれば新しいHTML+チャンクが取れて自己回復するので、
 * エラーページを見せる前に一度だけ試す（無限リロードはsessionStorageで防ぐ）。
 */
import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'consche_chunk_reload';

export function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy<T>(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (e) {
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        // 古いSWのキャッシュを一掃してから取り直す
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
          await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
        }
        window.location.reload();
        // リロードが走るまでレンダリングを保留
        await new Promise(() => undefined);
      }
      throw e;
    }
  });
}
