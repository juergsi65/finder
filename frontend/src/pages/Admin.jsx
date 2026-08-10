import { useEffect, useState } from "react";
import {
  apiAdminListUsers,
  apiAdminDeleteUser,
  apiAdminStats,
  apiAdminListFoundItems,
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
    <div className="h-full overflow-y-auto p-4 space-y-6 bg-white">
      <div>
        <h2 className="font-semibold text-gray-800 text-lg flex items-center gap-2">
          <span aria-hidden>👑</span> {t("admin.heading")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {t("admin.loggedInAs")} {user?.email}
        </p>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-trail-50 border border-trail-100 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-trail-700">{stats.users}</p>
            <p className="text-[11px] text-trail-700/70 mt-0.5">{t("admin.users")}</p>
          </div>
          <div className="bg-trail-50 border border-trail-100 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-trail-700">{stats.found_items_active}</p>
            <p className="text-[11px] text-trail-700/70 mt-0.5">{t("admin.foundItemsActive")}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-gray-600">{stats.found_items_archived}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{t("admin.foundItemsArchived")}</p>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          {t("admin.users")} ({users.length})
        </h3>
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 border border-gray-200 rounded-xl p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{u.display_name || u.email}</p>
                <p className="text-xs text-gray-400">
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
                <span className="shrink-0 text-xs text-gray-300 px-2.5 py-1.5">{t("admin.you")}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">{t("admin.foundItemsHeading")}</h3>
          <div className="flex rounded-full border border-gray-200 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setStatusTab("active")}
              className={`px-3 py-1 font-medium transition ${
                statusTab === "active" ? "bg-trail-600 text-white" : "bg-white text-gray-600"
              }`}
            >
              {t("admin.tabActive")}
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("archived")}
              className={`px-3 py-1 font-medium transition ${
                statusTab === "archived" ? "bg-trail-600 text-white" : "bg-white text-gray-600"
              }`}
            >
              {t("admin.tabArchived")}
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-400">-</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0" aria-hidden>
                    {categoryIcon(i.category)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{i.title}</p>
                    <p className="text-xs text-gray-400 truncate">{i.description || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(i)}
                    className="text-xs text-gray-600 font-semibold px-2.5 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition whitespace-nowrap"
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
  );
}
