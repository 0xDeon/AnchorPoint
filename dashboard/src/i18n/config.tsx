import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

type Language = 'en' | 'es' | 'pt';
type TranslationContextValue = {
  t: (key: string) => string;
  language: Language;
  changeLanguage: (language: Language) => void;
};

const resources: Record<Language, Record<string, unknown>> = {
  en,
  es,
  pt,
};

const getValue = (dictionary: Record<string, unknown>, key: string): string | undefined => {
  const parts = key.split('.');
  let current: unknown = dictionary;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
};

const TranslationContext = createContext<TranslationContextValue>({
  t: (key: string) => key,
  language: 'en',
  changeLanguage: () => undefined,
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('en');

  const value = useMemo<TranslationContextValue>(() => ({
    t: (key: string) => getValue(resources[language] as Record<string, unknown>, key) ?? key,
    language,
    changeLanguage: (nextLanguage: Language) => setLanguage(nextLanguage),
  }), [language]);

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
};

export const useTranslation = () => useContext(TranslationContext);

export default TranslationContext;
