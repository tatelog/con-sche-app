import { Languages } from 'lucide-react';
import { useLocale } from '../../i18n';

/** 日本語 / English の切替。現在の言語がひと目で分かるトグル */
export default function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 ${className}`}
      role="group"
      aria-label="Language / 言語"
    >
      <Languages size={14} className="text-slate-400 ml-2" aria-hidden />
      {(['ja', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`px-2.5 py-1 text-xs font-bold rounded-full transition-colors ${
            locale === code
              ? 'bg-primary-600 text-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {code === 'ja' ? '日本語' : 'EN'}
        </button>
      ))}
    </div>
  );
}
