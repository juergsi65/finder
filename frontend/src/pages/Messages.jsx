import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import { getConversations } from "../api.js";
import Spinner from "../components/Spinner.jsx";
import { categoryIcon } from "../categoryIcons.js";

export default function Messages() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [conversations, setConversations] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getConversations()
      .then(setConversations)
      .catch((err) => setError(err.message));
  }, []);

  if (!user) return null;

  if (conversations === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner className="w-8 h-8 text-trail-600" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 bg-white">
      <div className="max-w-2xl mx-auto w-full space-y-4">
        <h2 className="font-semibold text-slate-800 text-lg">{t("messages.heading")}</h2>

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        {conversations.length === 0 ? (
          <p className="text-sm text-slate-400">{t("messages.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {conversations.map((c) => {
              const last = c.messages[c.messages.length - 1];
              return (
                <li key={c.id}>
                  <Link
                    to={`/nachrichten/${c.id}`}
                    className="flex items-center gap-3 border border-slate-200 bg-white rounded-xl p-3 shadow-card hover:shadow-md hover:border-trail-300 transition"
                  >
                    <span className="text-xl shrink-0" aria-hidden>
                      {categoryIcon(c.found_item.category)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.found_item.title}</p>
                      {last && <p className="text-xs text-slate-500 truncate">{last.body}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
