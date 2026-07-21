import { useState } from 'react';
import { Link } from 'react-router-dom';
import { REGISTRATION_STORAGE_KEY } from '@/components/RegistrationGate';

interface Props {
  text: string;
  href: string;
  variant?: 'primary' | 'secondary' | 'white';
  disabled?: boolean;
}

/** この端末で登録済みか（LPとアプリは同一オリジンなのでアプリの登録フラグが読める） */
function isRegisteredDevice(): boolean {
  try {
    return localStorage.getItem(REGISTRATION_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export default function CTAButton({ text, href, variant = 'primary', disabled = false }: Props) {
  // 登録済み端末では「無料で使う」系のアプリ導線を再訪向けの文言に切り替える
  const [registered] = useState(isRegisteredDevice);
  const label = registered && href === '/app' ? 'アプリを開く' : text;

  const base = 'inline-flex items-center justify-center rounded-xl px-8 py-4 text-lg font-bold transition-all duration-300';

  if (disabled) {
    return <span className={`${base} bg-slate-200 text-slate-400 cursor-not-allowed`}>{label}</span>;
  }

  const styles =
    variant === 'primary'
      ? `${base} bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl cta-pulse`
      : variant === 'white'
        ? `${base} bg-white text-primary-700 hover:bg-primary-50 shadow-lg hover:shadow-xl`
        : `${base} border-2 border-primary-600 text-primary-600 hover:bg-primary-50`;

  if (href.startsWith('/')) {
    return <Link to={href} className={styles}>{label}</Link>;
  }
  return <a href={href} className={styles}>{label}</a>;
}
