import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import de from "./de.js";
import en from "./en.js";

const DICTS = { de, en };
const STORAGE_KEY = "trailfound_lang";

const LanguageContext = createContext(null);

function resolve(dict, key) {
  return key.split(".").reduce((obj, part) => (obj && typeof obj === "object" ? obj[part] : undefined), dict);
}

// German is the app's primary/default language (matches the target
// audience - German hiking/sports clubs) regardless of browser locale;
// English is available via the switcher and remembered once chosen.
function detectDefaultLang() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && DICTS[stored] ? stored : "de";
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectDefaultLang);

  // Keeps native browser UI (form validation messages, screen readers,
  // spell-check) in sync with the app's language, not just our own copy.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!DICTS[next]) return;
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  const t = useMemo(() => {
    const dict = DICTS[lang];
    const fallback = DICTS.de;
    return (key) => {
      const value = resolve(dict, key);
      if (value != null) return value;
      const fallbackValue = resolve(fallback, key);
      return fallbackValue != null ? fallbackValue : key;
    };
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation muss innerhalb von <LanguageProvider> verwendet werden");
  return ctx;
}
