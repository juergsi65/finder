import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, logout, unreadCount } = useAuth();
  const { t } = useTranslation();
  const isHome = location.pathname === "/";

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="bg-gradient-to-r from-trail-700 to-trail-600 text-white px-3 py-2.5 shadow-md shrink-0 relative z-[1100]">
      <div className="max-w-5xl mx-auto w-full flex items-center gap-1.5">
        {!isHome && (
          <Link to="/" className="text-white/90 hover:text-white text-xl leading-none px-1" aria-label={t("common.back")}>
            ←
          </Link>
        )}
        <Link to="/" className="font-bold text-base tracking-tight flex items-center gap-1.5 shrink-0">
          <span aria-hidden>🧭</span> {t("appName")}
        </Link>

        <div className="ml-auto flex items-center gap-1 text-sm shrink-0">
          <LanguageSwitcher />
          {loading ? null : user ? (
            <>
              <Link
                to="/verlust"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 active:scale-90 text-base transition"
                aria-label={t("nav.lost")}
                title={t("nav.lost")}
              >
                🚨
              </Link>
              <Link
                to="/nachrichten"
                className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 active:scale-90 text-base transition"
                aria-label={unreadCount > 0 ? `${t("nav.messages")} (${unreadCount})` : t("nav.messages")}
                title={t("nav.messages")}
              >
                💬
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none ring-2 ring-trail-700"
                    aria-hidden
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              {user.role === "admin" && (
                <Link
                  to="/admin"
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 active:scale-90 text-base transition"
                  aria-label={t("nav.admin")}
                  title={t("nav.admin")}
                >
                  👑
                </Link>
              )}
              <Link
                to="/profil"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 active:scale-90 text-base transition"
                aria-label={`${t("nav.profile")} (${user.email})`}
                title={user.email}
              >
                👤
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/15 active:scale-90 text-base transition"
                aria-label={t("nav.logout")}
                title={t("nav.logout")}
              >
                ⏻
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-white/90 hover:text-white font-medium px-1.5 whitespace-nowrap">
                {t("nav.login")}
              </Link>
              <Link
                to="/registrieren"
                className="bg-white text-trail-700 font-semibold rounded-full px-2.5 py-1 hover:bg-trail-50 whitespace-nowrap"
              >
                {t("nav.register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
