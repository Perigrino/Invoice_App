"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings-store";

export function HtmlLang() {
  const language = useSettingsStore((s) => s.settings.language);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("lang", language);
    html.setAttribute("dir", language === "ar" ? "rtl" : "ltr");
  }, [language]);

  return null;
}
