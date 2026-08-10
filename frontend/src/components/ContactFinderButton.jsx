import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import { contactFinder } from "../api.js";
import Spinner from "./Spinner.jsx";

/**
 * "Finder kontaktieren" - expands into a small inline message form. Sends
 * the first message of a private conversation; the finder's real email is
 * never shown here, the server relays a notification to them instead.
 */
export default function ContactFinderButton({ itemId, className = "" }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => navigate("/login", { state: { from: window.location.pathname } })}
        className={`text-sm font-semibold text-trail-700 border border-trail-600 rounded-full px-3 py-1.5 hover:bg-trail-50 transition ${className}`}
      >
        💬 {t("home.contactFinder")}
      </button>
    );
  }

  if (sent) {
    return <p className={`text-sm text-trail-700 ${className}`}>✅ {t("contact.sent")}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-sm font-semibold text-trail-700 border border-trail-600 rounded-full px-3 py-1.5 hover:bg-trail-50 transition ${className}`}
      >
        💬 {t("home.contactFinder")}
      </button>
    );
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError("");
    try {
      const conv = await contactFinder(itemId, body.trim());
      setSent(true);
      setTimeout(() => navigate(`/nachrichten/${conv.id}`), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSend} className={`space-y-2 ${className}`}>
      <p className="text-xs text-slate-500">{t("contact.intro")}</p>
      <textarea
        autoFocus
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("contact.placeholder")}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="flex-1 bg-trail-600 disabled:bg-slate-300 hover:bg-trail-700 text-white text-sm font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1.5"
        >
          {sending && <Spinner className="w-3.5 h-3.5" />}
          {sending ? t("contact.sending") : t("contact.send")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 px-3 rounded-lg hover:bg-slate-50"
        >
          {t("common.close")}
        </button>
      </div>
    </form>
  );
}
