import App from '@/App';
import { RegistrationGate } from '@/components/RegistrationGate';

/**
 * エディタ本体ページ（スタンドアロン）
 * データはブラウザ内（IndexedDB）とローカルファイル（.csa/.csl）に保存される。
 * 初回利用時のみ RegistrationGate が利用者登録を求める。
 */
export default function AppPage() {
  return (
    <RegistrationGate>
      <App />
    </RegistrationGate>
  );
}
