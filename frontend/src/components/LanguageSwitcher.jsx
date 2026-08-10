import { useTranslation } from "../i18n/LanguageContext.jsx";

export default function LanguageSwitcher() {
  const { lang, setLang } = useTranslation();

  return (
    <div className="flex items-center rounded-full border border-white/30 text-xs overflow-hidden shrink-0">
      {["de", "en"].map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`px-2 py-1 font-semibold uppercase transition ${
            lang === code ? "bg-white text-trail-700" : "text-white/80 hover:text-white"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
