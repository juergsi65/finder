import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import Spinner from "../components/Spinner.jsx";

export default function Register() {
  const { register } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("user");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await register({ email, password, role, displayName: role === "verein" ? displayName : undefined });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 bg-gradient-to-b from-trail-50 to-white overflow-y-auto">
      <div className="w-full max-w-sm py-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2" aria-hidden>
            📝
          </div>
          <h1 className="text-xl font-bold text-slate-800">{t("auth.registerHeading")}</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-white p-6 rounded-2xl shadow-card border border-slate-100"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t("auth.accountType")}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("user")}
                className={`rounded-xl border py-2.5 px-2 text-sm font-medium transition ${
                  role === "user"
                    ? "border-trail-600 bg-trail-50 text-trail-700 ring-2 ring-trail-500"
                    : "border-slate-200 text-slate-600 hover:border-trail-300"
                }`}
              >
                🧑 {t("auth.accountTypeUser")}
              </button>
              <button
                type="button"
                onClick={() => setRole("verein")}
                className={`rounded-xl border py-2.5 px-2 text-sm font-medium transition ${
                  role === "verein"
                    ? "border-trail-600 bg-trail-50 text-trail-700 ring-2 ring-trail-500"
                    : "border-slate-200 text-slate-600 hover:border-trail-300"
                }`}
              >
                🏔️ {t("auth.accountTypeVerein")}
              </button>
            </div>
          </div>

          {role === "verein" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.clubName")}</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("auth.clubNamePlaceholder")}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.email")}</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.password")}</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-400 mt-1">{t("auth.passwordHint")}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("auth.confirmPassword")}</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-trail-600 disabled:bg-slate-300 hover:bg-trail-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {submitting && <Spinner />}
            {submitting ? t("auth.registering") : t("auth.submitRegister")}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          {t("auth.hasAccount")}{" "}
          <Link to="/login" className="text-trail-700 font-semibold">
            {t("auth.toLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
