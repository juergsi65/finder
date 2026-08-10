import { Link } from "react-router-dom";
import { useTranslation } from "../i18n/LanguageContext.jsx";

/** Small "Impressum · Datenschutz" link row for public/account pages. */
export default function LegalFooter({ className = "" }) {
  const { t } = useTranslation();
  return (
    <p className={`text-center text-xs text-slate-400 ${className}`}>
      <Link to="/impressum" className="hover:text-slate-600 transition">
        {t("legal.imprintLink")}
      </Link>
      {" · "}
      <Link to="/datenschutz" className="hover:text-slate-600 transition">
        {t("legal.privacyLink")}
      </Link>
    </p>
  );
}
