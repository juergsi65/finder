import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import { getConversations } from "../api.js";
import { categoryIcon } from "../categoryIcons.js";
import Spinner from "./Spinner.jsx";

/**
 * "Stay on the map" shortcut to the user's conversations - same data as the
 * full Messages page (getConversations()), just surfaced without leaving
 * Home. Clicking a row navigates to the full conversation thread; nothing
 * here is a separate feed/notification model of its own, since messages
 * are the only per-item "live update" the app currently tracks.
 */
export default function LiveFeedPanel({ onClose }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [conversations, setConversations] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getConversations()
      .then(setConversations)
      .catch((err) => setError(err.message));
  }, []);

  function openConversation(id) {
    navigate(`/nachrichten/${id}`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[1300] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-float w-full sm:max-w-sm max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-5 pb-3 shrink-0">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
            <span aria-hidden>💬</span> {t("feed.heading")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{error}</p>
          )}

          {conversations === null ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="w-6 h-6 text-trail-600" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">{t("feed.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {conversations.map((c) => {
                const last = c.messages[c.messages.length - 1];
                const unread = c.unread_count > 0;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openConversation(c.id)}
                      className={`w-full flex items-center gap-3 border rounded-xl p-3 text-left transition ${
                        unread
                          ? "border-trail-300 bg-trail-50/40 hover:border-trail-400"
                          : "border-slate-200 bg-white hover:border-trail-300"
                      }`}
                    >
                      <span className="text-xl shrink-0" aria-hidden>
                        {categoryIcon(c.found_item.category)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${unread ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>
                          {c.found_item.title}
                        </p>
                        {last && <p className={`text-xs truncate ${unread ? "text-slate-700" : "text-slate-500"}`}>{last.body}</p>}
                      </div>
                      {unread && (
                        <span
                          className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center leading-none"
                          aria-label={`${c.unread_count} ungelesen`}
                        >
                          {c.unread_count > 9 ? "9+" : c.unread_count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
