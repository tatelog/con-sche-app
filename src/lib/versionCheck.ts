/**
 * 起動時のバージョン確認と自動リロード
 *
 * デプロイしても、端末に古いHTMLが残っていると新しい版に気づけない。
 * 2026-09-16、利用者の端末で「もう存在しないファイルを読みにいって失敗する」状態が起きた。
 * 起動のたびにサーバー上の最新版（/version.json）を確認し、食い違っていれば
 * キャッシュを消して読み直す。
 *
 * 判断に迷ったら「リロードしない」に倒す。誤って読み直すと、
 * 作業中の利用者の手を止めてしまうため。確認は起動直後だけに限っており、
 * 編集途中に勝手に読み直すことはない。
 */

import { clearSiteCaches } from '@/lib/staleCache';

const TRIED_FLAG = 'consche_version_reload';
const VERSION_URL = '/version.json';
const TIMEOUT_MS = 4000;

export type BuildComparison = 'same' | 'outdated' | 'unknown';

/** いま動いている版と、サーバー上の最新版を比べる */
export function compareBuild(current: string, latest: string): BuildComparison {
  if (typeof current !== 'string' || typeof latest !== 'string') return 'unknown';
  const a = current.trim();
  const b = latest.trim();
  if (!a || !b) return 'unknown';
  return a === b ? 'same' : 'outdated';
}

/** 読み直すべきか。一度試して駄目だった場合は繰り返さない */
export function shouldReload(comparison: BuildComparison, alreadyTried: boolean): boolean {
  return comparison === 'outdated' && !alreadyTried;
}

function readTried(): boolean {
  try {
    return sessionStorage.getItem(TRIED_FLAG) !== null;
  } catch {
    // sessionStorageが使えない環境では、繰り返しを防げないので試行済み扱いにする
    return true;
  }
}

function markTried(): void {
  try {
    sessionStorage.setItem(TRIED_FLAG, '1');
  } catch {
    // 記録できなくても読み直しは1回で済ませたいが、ここでは止められない
  }
}

function clearTried(): void {
  try {
    sessionStorage.removeItem(TRIED_FLAG);
  } catch {
    // 消せなくても実害はない
  }
}

async function fetchLatestBuild(): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // Service Workerもブラウザのキャッシュも通さずに取りに行く。
    // ここでキャッシュを経由すると、古い版を「最新」と誤認してしまう
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) return '';
    const body = (await res.json().catch(() => ({}))) as { build?: unknown };
    return typeof body.build === 'string' ? body.build : '';
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 起動時に一度だけ呼ぶ。古い版で動いていたらキャッシュを消して読み直す。
 * 何が起きても例外は投げない（確認の失敗でアプリを止めない）。
 */
export async function checkVersionOnStartup(currentBuild: string): Promise<void> {
  try {
    const latest = await fetchLatestBuild();
    const comparison = compareBuild(currentBuild, latest);

    if (comparison === 'same') {
      // 最新で動けている。次のデプロイに備えて記録を消しておく
      clearTried();
      return;
    }
    if (!shouldReload(comparison, readTried())) return;

    markTried();
    await clearSiteCaches();
    window.location.reload();
  } catch {
    // 確認できなくても、アプリはそのまま使える状態にしておく
  }
}
