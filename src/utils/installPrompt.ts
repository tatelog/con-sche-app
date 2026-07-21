/**
 * PWAインストールプロンプト(beforeinstallprompt)の捕捉
 *
 * このイベントはページ読込直後に一度だけ発火するため、遅延読み込みされるUIコンポーネント側で
 * リッスンすると取り逃す。必ずエントリ(main.tsx)から同期importされるこのモジュールで捕捉し、
 * UI側(HeaderExtras)はsubscribeで後から状態を受け取る。
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.gtag?.('event', 'pwa_install');
    listeners.forEach((fn) => fn());
  });
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function subscribeInstallPrompt(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
