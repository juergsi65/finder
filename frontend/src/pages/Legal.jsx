import { Link } from "react-router-dom";
import { useTranslation } from "../i18n/LanguageContext.jsx";

function LegalPage({ title, children }) {
  const { t } = useTranslation();
  return (
    <div className="h-full overflow-y-auto p-4 bg-white">
      <div className="max-w-2xl mx-auto w-full space-y-4">
        <Link to="/" className="text-sm text-trail-700 font-medium inline-flex items-center gap-1">
          ← {t("common.back")}
        </Link>
        <h2 className="font-semibold text-slate-800 text-lg">{title}</h2>
        <div className="prose prose-sm max-w-none text-slate-600 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function Imprint() {
  const { t } = useTranslation();
  return (
    <LegalPage title={t("legal.imprintTitle")}>
      <p className="whitespace-pre-line text-sm leading-relaxed">{t("legal.imprintBody")}</p>
    </LegalPage>
  );
}

export function Privacy() {
  const { t } = useTranslation();
  const sections = t("legal.privacySections");
  return (
    <LegalPage title={t("legal.privacyTitle")}>
      <p className="text-sm leading-relaxed">{t("legal.privacyIntro")}</p>
      {Array.isArray(sections) &&
        sections.map((section, i) => (
          <div key={i}>
            <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-1">{section.title}</h3>
            <p className="text-sm leading-relaxed">{section.body}</p>
          </div>
        ))}
    </LegalPage>
  );
}
