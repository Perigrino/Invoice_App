"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSettingsStore } from "@/store/settings-store";
import type { Translations, Locale } from "./types";
import { en } from "./locales/en";
import { fr } from "./locales/fr";
import { es } from "./locales/es";
import { ar } from "./locales/ar";

const locales: Record<Locale, Translations> = { en, fr, es, ar };

const TranslationContext = createContext<Translations>(en);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const language = useSettingsStore((s) => s.settings.language);
  const value = useMemo(() => locales[language] || en, [language]);
  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  return useContext(TranslationContext);
}
