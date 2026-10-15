import App from '@/App';
import { RegistrationGate } from '@/components/RegistrationGate';
import { Navigate } from 'react-router-dom';

/**
 * エディタ本体ページ（スタンドアロン）
 * データはブラウザ内（IndexedDB）とローカルファイル（.csa/.csl）に保存される。
 * 初回利用時のみ RegistrationGate が利用者登録を求める。
 */
export default function AppPage() {
  let registered = false;
  try { registered = !!JSON.parse(localStorage.getItem('consche_registration') || 'null')?.registeredAt; } catch { /* 登録画面へ進む */ }
  if (!registered && import.meta.env.VITE_SKIP_REGISTRATION !== 'true') return <Navigate to="/start" replace />;
  return (
    <RegistrationGate>
      <App />
    </RegistrationGate>
  );
}
