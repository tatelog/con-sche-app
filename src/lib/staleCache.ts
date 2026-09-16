/**
 * 端末に残った古いデータの一掃
 *
 * デプロイでJSのファイル名が変わったあと、端末に古いHTMLやキャッシュが残っていると
 * 「もう存在しないファイルを読みにいって失敗する」状態になる。
 * 2026-09-16、利用者から届いた画面にはまさにこれが出ていた。
 *
 * 当時の自動リロードは Service Worker の update() を呼ぶだけで、保存済みのファイルを
 * 消していなかった。update() はSWスクリプトを取り直すだけなので、古いファイルは残り、
 * リロードしても同じものを掴み続ける。ここで確実に消す。
 *
 * どの段階で失敗しても例外は投げない。復旧処理が落ちると、利用者は白い画面から出られなくなる。
 */

async function deleteAllCaches(): Promise<void> {
  try {
    if (typeof caches === 'undefined' || !caches?.keys) return;
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k).catch(() => undefined)));
  } catch {
    // 消せなくても次の手（Service Worker の解除）に進む
  }
}

async function unregisterAllServiceWorkers(): Promise<void> {
  try {
    const sw = navigator?.serviceWorker;
    if (!sw?.getRegistrations) return;
    const regs = await sw.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
  } catch {
    // 解除できなくても、キャッシュの削除だけでも効く場合がある
  }
}

/**
 * キャッシュとService Workerをまとめて消す。
 * 片方が失敗しても、もう片方は必ず実行する（半端に残すと結局復旧しない）。
 */
export async function clearSiteCaches(): Promise<void> {
  await Promise.all([deleteAllCaches(), unregisterAllServiceWorkers()]);
}
