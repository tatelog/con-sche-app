/**
 * 初回利用時の利用者登録ゲート
 * 氏名・会社名・メールアドレス（会社ドメイン）を登録するとエディタが使えるようになる。
 * 登録情報は登録APIに送信され、APIキーが1回だけ表示される。
 * 登録済みかどうかは localStorage のフラグで判定する。
 */

import { useState, type ReactNode } from 'react';
import { isBlockedDomain } from '@/config/blockedDomains';

export const REGISTRATION_STORAGE_KEY = 'consche_registration';
const STORAGE_KEY = REGISTRATION_STORAGE_KEY;
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

interface RegistrationState {
  registeredAt: string;
}

function loadRegistration(): RegistrationState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RegistrationState) : null;
  } catch {
    return null;
  }
}

export function RegistrationGate({ children }: { children: ReactNode }) {
  // VITE_SKIP_REGISTRATION=true でゲートを無効化（登録APIが無い環境でのプレビュー確認用）
  const skipGate = import.meta.env.VITE_SKIP_REGISTRATION === 'true';
  const [registered, setRegistered] = useState(() => skipGate || loadRegistration() !== null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [contactConsent, setContactConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [pendingSent, setPendingSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const complete = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ registeredAt: new Date().toISOString() }));
    setRegistered(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedCompany = company.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedCompany || !trimmedEmail) {
      setError('すべての項目を入力してください。');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('メールアドレスの形式が正しくありません。');
      return;
    }
    if (isBlockedDomain(trimmedEmail)) {
      setError('フリーメール・携帯キャリアのアドレスはご利用いただけません。会社のメールアドレスで登録してください。');
      return;
    }
    if (!contactConsent) {
      setError('ヒアリング等のご連絡についてご同意ください。');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, company: trimmedCompany, email: trimmedEmail }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        apiKey?: string;
        pendingVerification?: boolean;
        alreadyRegistered?: boolean;
        error?: string;
      };

      if (res.ok && body.pendingVerification) {
        // メール確認方式: 確認リンクのクリックで登録完了（/verify ページでキー表示）
        setPendingSent(true);
        return;
      }
      if (res.ok && body.apiKey) {
        setIssuedKey(body.apiKey);
        return;
      }
      if (res.status === 409 || body.alreadyRegistered) {
        // 登録済みメールアドレス: ゲートは通過させる（キーの再発行はしない）
        complete();
        return;
      }
      setError(body.error ?? `登録に失敗しました（${res.status}）。時間をおいて再度お試しください。`);
    } catch {
      setError('登録サーバーに接続できませんでした。ネットワーク接続を確認して再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!issuedKey) return;
    try {
      await navigator.clipboard.writeText(issuedKey);
      setCopied(true);
    } catch {
      // クリップボード不可の環境では手動コピーしてもらう
    }
  };

  if (registered) return <>{children}</>;

  return (
    <div className="h-screen">
      {children}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto">
          {pendingSent ? (
            <>
              <h2 className="text-xl font-black text-slate-800 mb-2">確認メールを送信しました</h2>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                <span className="font-bold">{email.trim().toLowerCase()}</span> 宛に確認メールをお送りしました。
                メール内のリンクをクリックすると登録が完了し、エディタをご利用いただけます（リンクの有効期限は24時間です）。
              </p>
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 leading-relaxed">
                メールが届かない場合は、迷惑メールフォルダをご確認ください。
                アドレスの入力間違いの場合は、このページを再読み込みして再度ご登録ください。
              </div>
            </>
          ) : issuedKey ? (
            <>
              <h2 className="text-xl font-black text-slate-800 mb-2">登録が完了しました</h2>
              <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                あなたのAPIコードを発行しました。外部システム連携・AI連携（API）で使用します。
                エディタを使うだけならこのコードは不要です。
              </p>
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 text-xs text-amber-800 leading-relaxed">
                <span className="font-bold">このコードは再発行できません。</span>
                この画面を閉じると二度と表示されず、同じメールアドレスで登録し直しても再発行されません。
                <span className="font-bold">AI連携・システム連携を使う予定がある方は、必ずこの場でコードを控えて安全な場所に保存してください。</span>
              </div>
              <div className="bg-slate-100 rounded-lg p-3 font-mono text-xs break-all mb-3 select-all">
                {issuedKey}
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
              <button
                onClick={complete}
                className="w-full rounded-xl px-4 py-3 text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >
                エディタを使い始める
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-black text-slate-800 mb-2">はじめる前に</h2>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Con-Scheは無料でご利用いただけます。どなたが利用されているかを把握するため、初回のみ登録をお願いしています。
                工程表データはお使いの端末にのみ保存され、サーバーには送信されません。
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">氏名</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="建設 太郎"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">会社名</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="株式会社〇〇工務店"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">メールアドレス（会社ドメイン）</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="taro@example.co.jp"
                    maxLength={254}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    フリーメール（Gmail・Yahoo等）・携帯キャリアのアドレスはご利用いただけません。
                  </p>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactConsent}
                    onChange={(e) => setContactConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary-600"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    サービス改善のため、ご登録のメールアドレス宛に利用状況のヒアリング等のご連絡をさせていただく場合があります。
                  </span>
                </label>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600 leading-relaxed">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting || !contactConsent}
                  className="w-full rounded-xl px-4 py-3 text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? '登録中...' : '登録して無料で使う'}
                </button>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  登録により
                  <a href="/terms" target="_blank" className="underline hover:text-slate-600">利用規約</a>
                  および
                  <a href="/privacy" target="_blank" className="underline hover:text-slate-600">プライバシーポリシー</a>
                  に同意したものとみなします。
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
