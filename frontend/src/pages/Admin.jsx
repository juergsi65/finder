import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  apiAdminListUsers,
  apiAdminDeleteUser,
  apiAdminStats,
  apiAdminListFoundItems,
  apiAdminListConversations,
  apiAdminGetSettings,
  apiAdminUpdateSettings,
  apiAdminListEmailLogs,
  apiAdminSendTestEmail,
  deleteFoundItem,
  setFoundItemStatus,
} from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import Spinner from "../components/Spinner.jsx";
import { categoryIcon } from "../categoryIcons.js";

export default function Admin() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [statusTab, setStatusTab] = useState("active");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAll(tab = statusTab) {
    setLoading(true);
    setError("");
    try {
      const [u, s, i] = await Promise.all([
        apiAdminListUsers(),
        apiAdminStats(),
        apiAdminListFoundItems(tab),
      ]);
      setUsers(u);
      setStats(s);
      setItems(i);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(statusTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab]);

  async function handleDeleteUser(id) {
    if (!window.confirm(t("admin.delete") + "?")) return;
    setError("");
    try {
      await apiAdminDeleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setStats((prev) => (prev ? { ...prev, users: prev.users - 1 } : prev));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteItem(id) {
    if (!window.confirm(t("admin.delete") + "?")) return;
    setError("");
    try {
      await deleteFoundItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleStatus(item) {
    setError("");
    const nextStatus = item.status === "active" ? "archived" : "active";
    try {
      await setFoundItemStatus(item.id, nextStatus);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      loadAll(statusTab);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading && !stats) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner className="w-8 h-8 text-trail-600" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 bg-white">
    <div className="max-w-3xl mx-auto w-full space-y-5">
      <div>
        <h2 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
          <span aria-hidden>👑</span> {t("admin.heading")}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {t("admin.loggedInAs")} {user?.email}
        </p>
      </div>

      {/* Horizontally scrollable on narrow screens - 4 tabs no longer fit
          a single fixed-width row on mobile without this. */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex rounded-full border border-slate-200 overflow-hidden text-sm w-max">
          <button
            type="button"
            onClick={() => setMainTab("overview")}
            className={`px-4 py-1.5 font-medium whitespace-nowrap shrink-0 transition ${
              mainTab === "overview" ? "bg-trail-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t("admin.tabOverview")}
          </button>
          <button
            type="button"
            onClick={() => setMainTab("messages")}
            className={`px-4 py-1.5 font-medium whitespace-nowrap shrink-0 transition ${
              mainTab === "messages" ? "bg-trail-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t("admin.tabMessages")}
          </button>
          <button
            type="button"
            onClick={() => setMainTab("apiConfig")}
            className={`px-4 py-1.5 font-medium whitespace-nowrap shrink-0 transition ${
              mainTab === "apiConfig" ? "bg-trail-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t("admin.tabApiConfig")}
          </button>
          <button
            type="button"
            onClick={() => setMainTab("emailLog")}
            className={`px-4 py-1.5 font-medium whitespace-nowrap shrink-0 transition ${
              mainTab === "emailLog" ? "bg-trail-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t("admin.tabEmailLog")}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      {mainTab === "overview" ? (
        <div className="space-y-6">
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-trail-50 border border-trail-100 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-trail-700">{stats.users}</p>
                <p className="text-[11px] text-trail-700/70 mt-0.5">{t("admin.users")}</p>
              </div>
              <div className="bg-trail-50 border border-trail-100 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-trail-700">{stats.found_items_active}</p>
                <p className="text-[11px] text-trail-700/70 mt-0.5">{t("admin.foundItemsActive")}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-slate-600">{stats.found_items_archived}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{t("admin.foundItemsArchived")}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-slate-600">{stats.conversations ?? "-"}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{t("admin.conversations")}</p>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              {t("admin.users")} ({users.length})
            </h3>
            <ul className="space-y-2">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 border border-slate-200 bg-white rounded-xl p-3 shadow-card hover:shadow-md transition-shadow">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.display_name || u.email}</p>
                    <p className="text-xs text-slate-400">
                      {u.role === "admin" ? "👑 " : u.role === "verein" ? "🏔️ " : ""}
                      {t(`roles.${u.role}`)}
                    </p>
                  </div>
                  {u.id !== user?.id ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u.id)}
                      className="shrink-0 text-xs text-red-600 font-semibold px-2.5 py-1.5 rounded-full border border-red-200 hover:bg-red-50 transition"
                    >
                      {t("admin.delete")}
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-300 px-2.5 py-1.5">{t("admin.you")}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">{t("admin.foundItemsHeading")}</h3>
              <div className="flex rounded-full border border-slate-200 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setStatusTab("active")}
                  className={`px-3 py-1 font-medium transition ${
                    statusTab === "active" ? "bg-trail-600 text-white" : "bg-white text-slate-600"
                  }`}
                >
                  {t("admin.tabActive")}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusTab("archived")}
                  className={`px-3 py-1 font-medium transition ${
                    statusTab === "archived" ? "bg-trail-600 text-white" : "bg-white text-slate-600"
                  }`}
                >
                  {t("admin.tabArchived")}
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-slate-400">-</p>
            ) : (
              <ul className="space-y-2">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 border border-slate-200 bg-white rounded-xl p-3 shadow-card hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0" aria-hidden>
                        {categoryIcon(i.category)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{i.title}</p>
                        <p className="text-xs text-slate-400 truncate">{i.description || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(i)}
                        className="text-xs text-slate-600 font-semibold px-2.5 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition whitespace-nowrap"
                      >
                        {i.status === "active" ? t("admin.archive") : t("admin.restore")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(i.id)}
                        className="text-xs text-red-600 font-semibold px-2.5 py-1.5 rounded-full border border-red-200 hover:bg-red-50 transition"
                      >
                        {t("admin.delete")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : mainTab === "messages" ? (
        <AdminMessagesPanel />
      ) : mainTab === "emailLog" ? (
        <EmailLogPanel />
      ) : (
        <ApiConfigPanel />
      )}
    </div>
    </div>
  );
}

function AdminMessagesPanel() {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    apiAdminListConversations()
      .then((data) => {
        if (!cancelled) setConversations(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>;
  }

  if (conversations === null) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="w-6 h-6 text-trail-600" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return <p className="text-sm text-slate-400">{t("admin.messagesEmpty")}</p>;
  }

  return (
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
                <p className="text-xs text-slate-400 truncate">
                  {t("admin.messagesReporter")}: {c.found_item.reporter?.display_name || c.found_item.reporter?.id || "-"}
                  {" · "}
                  {t("admin.messagesStartedBy")} #{c.starter_id}
                </p>
                {last && <p className="text-xs text-slate-500 truncate mt-0.5">{last.body}</p>}
              </div>
              <span className="shrink-0 text-xs text-trail-700 font-semibold px-2.5 py-1.5 rounded-full border border-trail-200 whitespace-nowrap">
                {t("admin.messagesOpen")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({ configured, t, label, notLabel }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
        configured ? "bg-trail-50 text-trail-700 border border-trail-200" : "bg-slate-100 text-slate-500 border border-slate-200"
      }`}
    >
      <span aria-hidden>{configured ? "●" : "○"}</span>
      {configured
        ? label || t("admin.apiConfig.stravaConfigured")
        : notLabel || t("admin.apiConfig.stravaNotConfigured")}
    </span>
  );
}

function ApiConfigPanel() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);

  const [form, setForm] = useState({
    strava_client_id: "",
    strava_client_secret: "",
    strava_redirect_uri: "",
    resend_api_key: "",
    resend_from: "",
    smtp_host: "",
    smtp_port: "",
    smtp_user: "",
    smtp_password: "",
    smtp_from: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const s = await apiAdminGetSettings();
      setSettings(s);
      setForm((prev) => ({
        ...prev,
        strava_client_id: s.strava_client_id || "",
        strava_redirect_uri: s.strava_redirect_uri || "",
        resend_from: s.resend_from || "",
        smtp_host: s.smtp_host || "",
        smtp_port: s.smtp_port != null ? String(s.smtp_port) : "",
        smtp_user: s.smtp_user || "",
        smtp_from: s.smtp_from || "",
        strava_client_secret: "",
        resend_api_key: "",
        smtp_password: "",
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload = {
        strava_client_id: form.strava_client_id,
        strava_redirect_uri: form.strava_redirect_uri,
        resend_from: form.resend_from,
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port === "" ? null : Number(form.smtp_port),
        smtp_user: form.smtp_user,
        smtp_from: form.smtp_from,
      };
      if (form.strava_client_secret) payload.strava_client_secret = form.strava_client_secret;
      if (form.resend_api_key) payload.resend_api_key = form.resend_api_key;
      if (form.smtp_password) payload.smtp_password = form.smtp_password;

      const updated = await apiAdminUpdateSettings(payload);
      setSettings(updated);
      setForm((prev) => ({ ...prev, strava_client_secret: "", resend_api_key: "", smtp_password: "" }));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearSecret(field) {
    setError("");
    setSaving(true);
    try {
      const updated = await apiAdminUpdateSettings({ [field]: "" });
      setSettings(updated);
      setForm((prev) => ({ ...prev, [field]: "" }));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTestEmail() {
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      const res = await apiAdminSendTestEmail(testEmailTo);
      setTestEmailResult({ ok: true, provider: res.provider });
    } catch (err) {
      setTestEmailResult({ ok: false, message: err.message });
    } finally {
      setTestEmailSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="w-6 h-6 text-trail-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
        {t("admin.apiConfig.intro")}
      </p>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      {/* Strava section */}
      <section className="border border-slate-200 rounded-xl p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <span aria-hidden>🚴</span> {t("admin.apiConfig.stravaSection")}
          </h3>
          <StatusBadge configured={settings?.strava_configured} t={t} />
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">{t("admin.apiConfig.clientId")}</span>
          <input
            type="text"
            value={form.strava_client_id}
            onChange={(e) => updateField("strava_client_id", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-400 transition"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">{t("admin.apiConfig.clientSecret")}</span>
          <div className="mt-1 flex gap-2">
            <input
              type="password"
              autoComplete="new-password"
              value={form.strava_client_secret}
              onChange={(e) => updateField("strava_client_secret", e.target.value)}
              placeholder={settings?.strava_client_secret_set ? t("admin.apiConfig.clientSecretSet") : t("admin.apiConfig.clientSecretNotSet")}
              className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-400 transition"
            />
            {settings?.strava_client_secret_set && (
              <button
                type="button"
                onClick={() => handleClearSecret("strava_client_secret")}
                className="shrink-0 text-xs text-red-600 font-semibold px-2.5 py-1.5 rounded-full border border-red-200 hover:bg-red-50 transition"
              >
                {t("admin.apiConfig.clear")}
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400">{t("admin.apiConfig.secretHint")}</span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">{t("admin.apiConfig.redirectUri")}</span>
          <input
            type="text"
            value={form.strava_redirect_uri}
            onChange={(e) => updateField("strava_redirect_uri", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-400 transition"
          />
        </label>
      </section>

      {/* Resend section - preferred email provider */}
      <section className="border border-slate-200 rounded-xl p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <span aria-hidden>📧</span> {t("admin.apiConfig.resendSection")}
          </h3>
          <StatusBadge
            configured={settings?.email_provider === "resend"}
            t={t}
            label={t("admin.apiConfig.resendActive")}
            notLabel={
              settings?.resend_api_key_set ? t("admin.apiConfig.configuredButInactive") : t("admin.apiConfig.stravaNotConfigured")
            }
          />
        </div>
        <p className="text-xs text-slate-400">{t("admin.apiConfig.resendHint")}</p>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">{t("admin.apiConfig.resendApiKey")}</span>
          <div className="mt-1 flex gap-2">
            <input
              type="password"
              autoComplete="new-password"
              value={form.resend_api_key}
              onChange={(e) => updateField("resend_api_key", e.target.value)}
              placeholder={settings?.resend_api_key_set ? t("admin.apiConfig.clientSecretSet") : t("admin.apiConfig.clientSecretNotSet")}
              className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-400 transition"
            />
            {settings?.resend_api_key_set && (
              <button
                type="button"
                onClick={() => handleClearSecret("resend_api_key")}
                className="shrink-0 text-xs text-red-600 font-semibold px-2.5 py-1.5 rounded-full border border-red-200 hover:bg-red-50 transition"
              >
                {t("admin.apiConfig.clear")}
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400">{t("admin.apiConfig.secretHint")}</span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">{t("admin.apiConfig.resendFrom")}</span>
          <input
            type="text"
            value={form.resend_from}
            onChange={(e) => updateField("resend_from", e.target.value)}
            placeholder="TrailFound <onboarding@resend.dev>"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-400 transition"
          />
          <span className="text-[11px] text-slate-400">{t("admin.apiConfig.resendFromHint")}</span>
        </label>
      </section>

      {/* SMTP section - fallback, only used when Resend isn't configured */}
      <section className="border border-slate-200 rounded-xl p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <span aria-hidden>✉️</span> {t("admin.apiConfig.smtpSection")}
          </h3>
          <StatusBadge
            configured={settings?.email_provider === "smtp"}
            t={t}
            label={t("admin.apiConfig.smtpConfigured")}
            notLabel={settings?.smtp_configured ? t("admin.apiConfig.configuredButInactive") : t("admin.apiConfig.smtpNotConfigured")}
          />
        </div>
        <p className="text-xs text-slate-400">{t("admin.apiConfig.smtpFallbackHint")}</p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-1">
            <span className="text-xs font-medium text-slate-600">{t("admin.apiConfig.smtpHost")}</span>
            <input
              type="text"
              value={form.smtp_host}
              onChange={(e) => updateField("smtp_host", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-400 transition"
            />
          </label>
          <label className="block col-span-1">
            <span className="text-xs font-medium text-slate-600">{t("admin.apiConfig.smtpPort")}</span>
            <input
              type="number"
              value={form.smtp_port}
              onChange={(e) => updateField("smtp_port", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-400 transition"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">{t("admin.apiConfig.smtpUser")}</span>
          <input
            type="text"
            value={form.smtp_user}
            onChange={(e) => updateField("smtp_user", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-400 transition"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">{t("admin.apiConfig.smtpPassword")}</span>
          <div className="mt-1 flex gap-2">
            <input
              type="password"
              autoComplete="new-password"
              value={form.smtp_password}
              onChange={(e) => updateField("smtp_password", e.target.value)}
              placeholder={settings?.smtp_password_set ? t("admin.apiConfig.smtpPasswordSet") : t("admin.apiConfig.smtpPasswordNotSet")}
              className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-400 transition"
            />
            {settings?.smtp_password_set && (
              <button
                type="button"
                onClick={() => handleClearSecret("smtp_password")}
                className="shrink-0 text-xs text-red-600 font-semibold px-2.5 py-1.5 rounded-full border border-red-200 hover:bg-red-50 transition"
              >
                {t("admin.apiConfig.clear")}
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400">{t("admin.apiConfig.secretHint")}</span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">{t("admin.apiConfig.smtpFrom")}</span>
          <input
            type="text"
            value={form.smtp_from}
            onChange={(e) => updateField("smtp_from", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-400 transition"
          />
        </label>
      </section>

      {/* Test email - not part of the settings form (its own button, not a
          submit), so an admin can verify live delivery without saving. */}
      <section className="border border-slate-200 rounded-xl p-4 shadow-card space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <span aria-hidden>🧪</span> {t("admin.apiConfig.testEmailSection")}
        </h3>
        <p className="text-xs text-slate-400">{t("admin.apiConfig.testEmailHint")}</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={testEmailTo}
            onChange={(e) => {
              setTestEmailTo(e.target.value);
              setTestEmailResult(null);
            }}
            placeholder={t("admin.apiConfig.testEmailPlaceholder")}
            className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-400 transition"
          />
          <button
            type="button"
            onClick={handleSendTestEmail}
            disabled={testEmailSending || !testEmailTo}
            className="shrink-0 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
          >
            {testEmailSending && <Spinner className="w-4 h-4" />}
            {testEmailSending ? t("admin.apiConfig.testEmailSending") : t("admin.apiConfig.testEmailSend")}
          </button>
        </div>
        {testEmailResult &&
          (testEmailResult.ok ? (
            <p className="text-xs text-trail-700 bg-trail-50 border border-trail-100 rounded-lg px-3 py-2">
              ✅ {t("admin.apiConfig.testEmailSuccess")} ({testEmailResult.provider})
            </p>
          ) : (
            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              ❌ {testEmailResult.message}
            </p>
          ))}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-trail-600 hover:bg-trail-700 active:scale-95 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-card transition"
        >
          {saving ? t("admin.apiConfig.saving") : t("admin.apiConfig.save")}
        </button>
        {saved && !saving && <span className="text-sm text-trail-700">{t("admin.apiConfig.saved")}</span>}
      </div>

      {settings?.updated_at && (
        <p className="text-[11px] text-slate-400">
          {t("admin.apiConfig.lastUpdated")}: {new Date(settings.updated_at).toLocaleString()}
        </p>
      )}
    </form>
  );
}

function EmailLogPanel() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");

  async function load(filter) {
    setError("");
    try {
      const data = await apiAdminListEmailLogs({ statusFilter: filter || undefined });
      setLogs(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  if (error) {
    return <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{t("admin.emailLog.intro")}</p>
        <div className="flex rounded-full border border-slate-200 overflow-hidden text-xs shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            className={`px-3 py-1 font-medium transition ${statusFilter === "" ? "bg-trail-600 text-white" : "bg-white text-slate-600"}`}
          >
            {t("admin.emailLog.filterAll")}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("sent")}
            className={`px-3 py-1 font-medium transition ${statusFilter === "sent" ? "bg-trail-600 text-white" : "bg-white text-slate-600"}`}
          >
            {t("admin.emailLog.filterSent")}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("failed")}
            className={`px-3 py-1 font-medium transition ${statusFilter === "failed" ? "bg-trail-600 text-white" : "bg-white text-slate-600"}`}
          >
            {t("admin.emailLog.filterFailed")}
          </button>
        </div>
      </div>

      {logs === null ? (
        <div className="flex items-center justify-center py-10">
          <Spinner className="w-6 h-6 text-trail-600" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-slate-400">{t("admin.emailLog.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="border border-slate-200 bg-white rounded-xl p-3 shadow-card space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 truncate">{log.subject}</p>
                <span
                  className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    log.status === "sent"
                      ? "bg-trail-50 text-trail-700 border border-trail-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {log.status === "sent" ? t("admin.emailLog.statusSent") : t("admin.emailLog.statusFailed")}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {t("admin.emailLog.to")} {log.recipient} · {log.provider}
                {log.created_at && ` · ${new Date(log.created_at).toLocaleString()}`}
              </p>
              {log.error && <p className="text-xs text-red-600 truncate">{log.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
