import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from '../locales/en';
import sv from '../locales/sv';
import storage from '../utils/safeStorage';

type Lang = 'sv' | 'en';
type Dict = typeof sv;

const resources: Record<Lang, Dict> = { sv, en };
const STORAGE_KEY = 'app-language';

type TranslationContextType = {
  lang: Lang;
  setLanguage: (l: Lang) => void;
  t: (path: string, fallback?: string | ((...args: any[]) => string), args?: any) => string;
};

const TranslationContext = createContext<TranslationContextType>({
  lang: 'sv',
  setLanguage: () => {},
  t: (key) => key,
});

function getValue(path: string, lang: Lang, args?: any): string | undefined {
  const parts = path.split('.');
  let current: any = resources[lang];
  for (const p of parts) {
    if (current && typeof current === 'object' && p in current) {
      current = current[p];
    } else {
      return undefined;
    }
  }
  if (typeof current === 'function') {
    return current(args);
  }
  return current as string;
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('sv');

  useEffect(() => {
    storage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'sv' || val === 'en') setLang(val);
    });
  }, []);

  const setLanguage = useCallback((l: Lang) => {
    setLang(l);
    storage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const t = useCallback(
    (path: string, fallback?: string | ((...args: any[]) => string), args?: any) => {
      const val = getValue(path, lang, args);
      if (val !== undefined) return val;
      if (typeof fallback === 'function') return fallback(args);
      if (typeof fallback === 'string') return fallback;
      return path;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLanguage, t }), [lang, setLanguage, t]);

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation() {
  return useContext(TranslationContext);
}
