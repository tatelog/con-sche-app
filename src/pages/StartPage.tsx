import { useEffect } from 'react';
import { RegistrationGate } from '@/components/RegistrationGate';

function RegisteredStart() {
  useEffect(() => {
    document.dispatchEvent(new Event('consche:registration-ready'));
  }, []);
  return <main className="min-h-screen flex items-center justify-center bg-slate-100"><a href="/app" className="text-primary-600 underline">アプリへ進む</a></main>;
}

/** 登録が終わるまでアプリ本体をマウントしない開始ページ。 */
export default function StartPage() {
  return <RegistrationGate><RegisteredStart /></RegistrationGate>;
}
