/**
 * 起動に失敗したときの案内画面
 *
 * 2026-09-16、利用者の画面に出ていたのは React Router の既定のエラー表示だった。
 *   Unexpected Application Error!
 *   Failed to fetch dynamically imported module: .../assets/AppPage-xxxx.js
 * 英語の例外メッセージがそのまま出るだけで、利用者には何をすればいいか分からない。
 *
 * 原因の多くは「端末に残った古いデータが、もう存在しないファイルを読みにいく」こと。
 * それならボタン一つで消して読み直せるようにする。index.html に埋め込んだ見張り役と
 * 同じ体験に揃えてある（あちらはアプリ本体が起動すらしなかった場合の担当）。
 */

import { useState } from 'react';
import { clearSiteCaches } from '@/lib/staleCache';

export function StartupError() {
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    setBusy(true);
    try {
      sessionStorage.removeItem('consche_chunk_reload');
    } catch {
      // 消せなくてもリロードは試す
    }
    await clearSiteCaches();
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="text-center max-w-md">
        <h1 className="text-lg font-black text-slate-800 mb-2">読み込めませんでした</h1>
        <p className="text-sm text-slate-600 mb-5 leading-relaxed">
          お使いの端末に残っていた古いデータが原因の可能性があります。
          <br />
          下のボタンを押しても直らない場合は、お手数ですがブラウザを一度終了してから開き直してください。
        </p>
        <button
          onClick={retry}
          disabled={busy}
          className="px-6 py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {busy ? '読み込み直しています...' : 'データを消して再読み込み'}
        </button>
        <p className="mt-5 text-xs text-slate-500">
          それでも解決しない場合:{' '}
          <a href="mailto:ishikawa.yutaka@tatelog.biz" className="underline hover:text-slate-700">
            ishikawa.yutaka@tatelog.biz
          </a>
        </p>
      </div>
    </div>
  );
}
