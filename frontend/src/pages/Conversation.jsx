import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import { getConversation, sendMessage } from "../api.js";
import Spinner from "../components/Spinner.jsx";
import { categoryIcon } from "../categoryIcons.js";

export default function Conversation() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [conv, setConv] = useState(null);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    getConversation(id)
      .then(setConv)
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages?.length]);

  async function handleSend(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError("");
    try {
      const updated = await sendMessage(id, body.trim());
      setConv(updated);
      setBody("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (!user) return null;

  if (error && !conv) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/nachrichten" className="text-trail-700 font-medium text-sm">
          {t("messages.backToList")}
        </Link>
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner className="w-8 h-8 text-trail-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b border-slate-100 p-3">
        <div className="max-w-2xl mx-auto w-full flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {categoryIcon(conv.found_item.category)}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{conv.found_item.title}</p>
            <p className="text-xs text-slate-400">
              {t("home.foundOn")} {conv.found_item.found_date}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto w-full space-y-3">
          {conv.messages.map((m) => {
            const mine = m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine ? "bg-trail-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 px-4 pb-1 max-w-2xl mx-auto w-full">{error}</p>}

      <form onSubmit={handleSend} className="border-t border-slate-100 p-3">
        <div className="max-w-2xl mx-auto w-full flex gap-2">
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("messages.reply")}
            className="flex-1 border border-slate-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="bg-trail-600 disabled:bg-slate-300 hover:bg-trail-700 text-white font-semibold px-4 rounded-full transition flex items-center justify-center"
          >
            {sending ? <Spinner /> : t("messages.send")}
          </button>
        </div>
      </form>
    </div>
  );
}
