/**
 * ツールバー右端の共通ボタン群: ホーム画面追加(星) / お知らせ(ベル+未読赤ドット) / お問い合わせ(メール)
 *
 * - 星: PWAインストール誘導。Chromium系はbeforeinstallpromptを使ったワンタップ追加、
 *   iOS Safariは手順案内、その他はブックマーク(Ctrl+D)案内にフォールバック
 * - ベル: GET /api/announcements の一覧をポップオーバー表示。
 *   「最新お知らせ日時 > この端末の最終既読日時」で赤ドットを点け、開いたら既読化
 * - メール: モーダルフォームから POST /api/contact に送信
 */

import { useEffect, useRef, useState } from 'react';
import { Star, Bell, Mail, Share, SquarePlus, MonitorDown, Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchAnnouncements,
  hasUnread,
  loadLastReadAt,
  markAllRead,
  type Announcement,
} from '@/utils/announcements';
import { validateContact } from '@/utils/contactValidation';
import { getInstallPrompt, subscribeInstallPrompt } from '@/utils/installPrompt';
import { REGISTRATION_STORAGE_KEY } from '@/components/RegistrationGate';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    // iPadOSはMac相当のUAを名乗るためタッチ有無で判別
    || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true;
}

function isMac(): boolean {
  return /Mac/.test(navigator.userAgent) && !isIOS();
}

/* ---------- ポップオーバー共通枠 ---------- */

function Popover({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-[90] bg-white border border-gray-200 rounded-xl shadow-xl w-[min(20rem,calc(100vw-1rem))] max-h-[70vh] overflow-y-auto"
    >
      {children}
    </div>
  );
}

/* ---------- 星: ホーム画面追加 / お気に入り ---------- */

function InstallStar({ iconSize }: { iconSize: number }) {
  const [open, setOpen] = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => subscribeInstallPrompt(() => forceRender((n) => n + 1)), []);

  const handleInstall = async () => {
    const deferredInstallPrompt = getInstallPrompt();
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      toast.success('ホーム画面に追加しました。次回からアイコンで起動できます。');
      setOpen(false);
    }
  };

  const bookmarkKey = isMac() ? '⌘+D' : 'Ctrl+D';

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!open) window.gtag?.('event', 'star_click');
          setOpen(!open);
        }}
        className={`p-2 rounded hover:bg-gray-100 transition-colors ${open ? 'text-amber-500 bg-gray-100' : 'text-gray-600'}`}
        title="ホーム画面に追加 / お気に入り登録"
      >
        <Star size={iconSize} />
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)}>
          <div className="p-4 space-y-3">
            <div className="font-bold text-sm text-slate-800">いつでもすぐ開けるようにする</div>
            {isStandalone() ? (
              <p className="text-xs text-slate-600 leading-relaxed">
                ホーム画面から起動中です ✓<br />このままいつでもアイコンから開けます。
              </p>
            ) : isIOS() ? (
              <div className="text-xs text-slate-600 leading-relaxed space-y-2">
                <p>iPhone / iPadでは次の手順でホーム画面に追加できます:</p>
                <ol className="space-y-1.5 list-none">
                  <li className="flex items-center gap-2">
                    <span className="font-bold">1.</span>
                    <Share size={14} className="shrink-0 text-primary-600" />
                    <span>下（iPadは右上）の共有ボタンをタップ</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-bold">2.</span>
                    <SquarePlus size={14} className="shrink-0 text-primary-600" />
                    <span>「ホーム画面に追加」を選択</span>
                  </li>
                </ol>
                <p className="text-slate-400">以後、ホーム画面のアイコンからアプリのように起動できます。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getInstallPrompt() ? (
                  <button
                    onClick={handleInstall}
                    className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                  >
                    <MonitorDown size={16} />
                    ホーム画面に追加する
                  </button>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    ワンタップ追加はChromeまたはEdgeで開くと利用できます。
                  </p>
                )}
                <p className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Bookmark size={14} className="shrink-0 text-primary-600" />
                  <span><span className="font-mono font-bold">{bookmarkKey}</span> でお気に入りにも登録できます</span>
                </p>
              </div>
            )}
          </div>
        </Popover>
      )}
    </div>
  );
}

/* ---------- ベル: お知らせ ---------- */

function AnnouncementsBell({ iconSize }: { iconSize: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [unread, setUnread] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchAnnouncements()
      .then((list) => {
        setItems(list);
        setUnread(hasUnread(list[0]?.created_at ?? null, loadLastReadAt()));
      })
      .catch(() => { /* オフライン等では黙ってドット無し表示 */ })
      .finally(() => setLoaded(true));
  }, []);

  const handleToggle = () => {
    if (!open) {
      window.gtag?.('event', 'news_open');
      markAllRead();
      setUnread(false);
    }
    setOpen(!open);
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className={`relative p-2 rounded hover:bg-gray-100 transition-colors ${open ? 'text-primary-600 bg-gray-100' : 'text-gray-600'}`}
        title="お知らせ"
      >
        <Bell size={iconSize} />
        {unread && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)}>
          <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm text-slate-800">お知らせ</div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-xs text-slate-400 text-center">
              {loaded ? 'お知らせはまだありません' : '読み込み中...'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="text-[10px] text-slate-400 mb-0.5">
                    {new Date(a.created_at).toLocaleDateString('ja-JP')}
                  </div>
                  <div className="text-xs font-bold text-slate-800 mb-1">{a.title}</div>
                  <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{a.body}</div>
                </li>
              ))}
            </ul>
          )}
        </Popover>
      )}
    </div>
  );
}

/* ---------- メール: お問い合わせ ---------- */

function loadRegisteredProfile(): { name?: string; company?: string; email?: string } {
  try {
    const raw = localStorage.getItem(REGISTRATION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { name?: string; company?: string; email?: string }) : {};
  } catch {
    return {};
  }
}

function ContactButton({ iconSize }: { iconSize: number }) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = () => {
    const profile = loadRegisteredProfile();
    setCompany((v) => v || profile.company || '');
    setName((v) => v || profile.name || '');
    setEmail((v) => v || profile.email || '');
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateContact({ company, name, email, message });
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: company.trim(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          inquiryTypes: ['アプリ内お問い合わせ'],
          message: message.trim(),
        }),
      });
      if (res.ok) {
        window.gtag?.('event', 'contact_submit');
        toast.success('お問い合わせを送信しました。折り返しご連絡いたします。');
        setMessage('');
        setOpen(false);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `送信に失敗しました（${res.status}）。時間をおいて再度お試しください。`);
    } catch {
      setError('送信できませんでした。ネットワーク接続を確認して再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
        title="お問い合わせ"
      >
        <Mail size={iconSize} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black text-slate-800 mb-1">お問い合わせ</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              不具合報告・ご要望・導入のご相談など、お気軽にお送りください。
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">会社名</label>
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} maxLength={200} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">氏名</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={100} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">メールアドレス</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} maxLength={254} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">本文</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`${inputClass} min-h-[110px] resize-y`}
                  maxLength={4000}
                  placeholder="お問い合わせ内容をご記入ください"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600 leading-relaxed">{error}</div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  閉じる
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? '送信中...' : '送信する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- まとめ ---------- */

export function HeaderExtras({ compact = false }: { compact?: boolean }) {
  const iconSize = compact ? 18 : 20;
  return (
    <div className="flex items-center">
      <InstallStar iconSize={iconSize} />
      <AnnouncementsBell iconSize={iconSize} />
      <ContactButton iconSize={iconSize} />
    </div>
  );
}
