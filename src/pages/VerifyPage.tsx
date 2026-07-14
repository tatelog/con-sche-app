/**
 * メール確認リンクの着地ページ（/verify?token=...）
 * トークンを /api/verify に送って本登録し、発行されたAPIコードを1回だけ表示する。
 * アプリと同一オリジンなので、登録済みフラグ（localStorage）をここで書ける。
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { REGISTRATION_STORAGE_KEY } from '@/components/RegistrationGate';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

type VerifyState =
  | { status: 'verifying' }
  | { status: 'success'; apiKey: string }
  | { status: 'already' }
  | { status: 'error'; message: string };

function markRegistered() {
  localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify({ registeredAt: new Date().toISOString() }));
}

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerifyState>({ status: 'verifying' });
  const [copied, setCopied] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return; // StrictMode等での二重実行防止（トークンは1回で消費される）
    requested.current = true;

    const token = searchParams.get('token') ?? '';
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          apiKey?: string;
          alreadyRegistered?: boolean;
          error?: string;
        };
        if (res.ok && body.apiKey) {
          markRegistered();
          setState({ status: 'success', apiKey: body.apiKey });
        } else if (res.status === 409 || body.alreadyRegistered) {
          markRegistered();
          setState({ status: 'already' });
        } else {
          setState({ status: 'error', message: body.error ?? '確認に失敗しました。時間をおいて再度お試しください。' });
        }
      } catch {
        setState({ status: 'error', message: 'サーバーに接続できませんでした。ネットワーク接続を確認して再度お試しください。' });
      }
    })();
  }, [searchParams]);

  const handleCopy = async () => {
    if (state.status !== 'success') return;
    try {
      await navigator.clipboard.writeText(state.apiKey);
      setCopied(true);
    } catch {
      // クリップボード不可の環境では手動コピーしてもらう
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {state.status === 'verifying' && (
          <p className="text-sm text-slate-600 text-center py-8">確認しています...</p>
        )}

        {state.status === 'success' && (
          <>
            <h2 className="text-xl font-black text-slate-800 mb-2">登録が完了しました</h2>
            <p className="text-sm text-slate-600 mb-3 leading-relaxed">
              あなたのAPIコードを発行しました。外部システム連携・AI連携（API）で使用します。
              エディタを使うだけならこのコードは不要です。
            </p>
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 text-xs text-amber-800 leading-relaxed">
              <span className="font-bold">このコードは再発行できません。</span>
              この画面を閉じると二度と表示されません。
              <span className="font-bold">AI連携・システム連携を使う予定がある方は、必ずこの場でコードを控えて安全な場所に保存してください。</span>
            </div>
            <div className="bg-slate-100 rounded-lg p-3 font-mono text-xs break-all mb-3 select-all">
              {state.apiKey}
            </div>
            <p className="text-xs text-slate-500 mb-3">
              使い方は
              <a href="/api-docs" target="_blank" className="underline text-primary-600">APIドキュメント</a>
              をご覧ください。
            </p>
            <button
              onClick={handleCopy}
              className="w-full mb-3 rounded-xl px-4 py-2.5 text-sm font-bold border-2 border-primary-600 text-primary-600 hover:bg-primary-50 transition-colors"
            >
              {copied ? 'コピーしました ✓' : 'コードをコピー'}
            </button>
            <Link
              to="/app"
              className="block text-center w-full rounded-xl px-4 py-3 text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              エディタを使い始める
            </Link>
          </>
        )}

        {state.status === 'already' && (
          <>
            <h2 className="text-xl font-black text-slate-800 mb-2">確認済みです</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              このメールアドレスは既に登録が完了しています。そのままエディタをご利用いただけます
              （APIコードの再発行はされません）。
            </p>
            <Link
              to="/app"
              className="block text-center w-full rounded-xl px-4 py-3 text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              エディタを使い始める
            </Link>
          </>
        )}

        {state.status === 'error' && (
          <>
            <h2 className="text-xl font-black text-slate-800 mb-2">確認できませんでした</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-xs text-red-600 leading-relaxed">
              {state.message}
            </div>
            <Link
              to="/app"
              className="block text-center w-full rounded-xl px-4 py-3 text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              登録画面へ戻る
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
