import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

export type SupportedLanguage = 'en' | 'fr';

interface LanguageContextValue {
  readonly language: SupportedLanguage;
  readonly setLanguage: (language: SupportedLanguage) => void;
}

const FALLBACK_LANGUAGE: SupportedLanguage = 'en';
const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'fr'];

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function resolveInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return FALLBACK_LANGUAGE;
  }

  const candidates: (string | undefined)[] = [];

  if (Array.isArray((navigator as Navigator).languages)) {
    candidates.push(...(navigator as Navigator).languages);
  }

  if (typeof navigator.language === 'string') {
    candidates.push(navigator.language);
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const normalized = candidate.slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage)) {
      return normalized as SupportedLanguage;
    }
  }

  return FALLBACK_LANGUAGE;
}

export interface LanguageProviderProps extends PropsWithChildren {
  readonly defaultLanguage?: SupportedLanguage;
}

export function LanguageProvider({ children, defaultLanguage }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<SupportedLanguage>(defaultLanguage ?? resolveInitialLanguage());

  useEffect(() => {
    if (defaultLanguage && defaultLanguage !== language) {
      setLanguageState(defaultLanguage);
    }
  }, [defaultLanguage, language]);

  const setLanguage = useCallback((nextLanguage: SupportedLanguage) => {
    setLanguageState(SUPPORTED_LANGUAGES.includes(nextLanguage) ? nextLanguage : FALLBACK_LANGUAGE);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

