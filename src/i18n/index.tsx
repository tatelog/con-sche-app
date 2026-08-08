/**
 * LP の言語切替（日本語 / English）
 *
 * 設計方針:
 * - 日本語（lpContent.ts）を正とし、英語は「差分だけ」持つ（lpContent.en.ts）。
 *   英訳が未整備のセクションは日本語のまま表示されるため、少しずつ英訳を足せる。
 * - i18nライブラリは入れない。LPの文言は静的な定数のため、オブジェクトの差し替えで足りる。
 * - 判定順は URLパラメータ（?lang=en） > 保存済みの選択 > ブラウザの言語設定。
 *   URL指定を最優先にしているのは、英語話者へ直接リンクを渡す用途を想定しているため。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import * as JA from '../data/lpContent';
import { EN } from '../data/lpContent.en';

export type Locale = 'ja' | 'en';

export type LPContent = typeof JA;

const STORAGE_KEY = 'con-sche-lp-locale';

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'ja';

  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'en' || fromUrl === 'ja') return fromUrl;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ja') return saved;
  } catch {
    // プライベートモード等でlocalStorageが使えなくても表示は続ける
  }

  return navigator.language?.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  content: LPContent;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 保存できなくても切替自体は成立させる
    }
  }, []);

  // 英語は差分マージ。未翻訳のキーは日本語がそのまま残る
  const content = useMemo<LPContent>(
    () => (locale === 'en' ? { ...JA, ...EN } : JA),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, content }), [locale, setLocale, content]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('LocaleProvider の外で useLP / useLocale は使えません');
  }
  return ctx;
}

/** LPの文言を取得する。現在の言語に応じた内容が返る */
export function useLP(): LPContent {
  return useLocaleContext().content;
}

/** 言語の取得と切替 */
export function useLocale(): { locale: Locale; setLocale: (next: Locale) => void } {
  const { locale, setLocale } = useLocaleContext();
  return { locale, setLocale };
}
