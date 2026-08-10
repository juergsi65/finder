import { useEffect, useState } from "react";
import { apiAdminListUsers, apiAdminDeleteUser, apiAdminStats, getFoundItems, deleteFoundItem } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import Spinner from "../components/Spinner.jsx";
import { categoryIcon } from "../categoryIcons.js";

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [u, s, i] = await Promise.all([apiAdminListUsers(), apiAdminStats(), getFoundItems()]);
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
    loadAll();
  }, []);

  async function handleDeleteUser(id) {
    if (!window.confirm("Diesen Nutzer wirklich löschen? Das kann nicht rückgängig gemacht werden.")) return;
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
    if (!window.confirm("Diesen Fund-Pin wirklich löschen?")) return;
    setError("");
    try {
      await deleteFoundItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setStats((prev) => (prev ? { ...prev, found_items: prev.found_items - 1 } : prev));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
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
          <span aria-hidden>👑</span> Admin
        </h2>
        <p className="text-sm text-gray-500 mt-1">Angemeldet als {user?.email}</p>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-trail-50 border border-trail-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-trail-700">{stats.users}</p>
            <p className="text-xs text-trail-700/70 mt-0.5">Nutzer</p>
          </div>
          <div className="bg-trail-50 border border-trail-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-trail-700">{stats.found_items}</p>
            <p className="text-xs text-trail-700/70 mt-0.5">Fund-Pins</p>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Nutzer ({users.length})</h3>
        <ul className="space-y-2">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-2 border border-gray-200 rounded-xl p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{u.email}</p>
                <p className="text-xs text-gray-400">{u.role === "admin" ? "👑 Admin" : "Nutzer"}</p>
              </div>
              {u.id !== user?.id ? (
                <button
                  type="button"
                  onClick={() => handleDeleteUser(u.id)}
                  className="shrink-0 text-xs text-red-600 font-semibold px-2.5 py-1.5 rounded-full border border-red-200 hover:bg-red-50 transition"
                >
                  Löschen
                </button>
              ) : (
                <span className="shrink-0 text-xs text-gray-300 px-2.5 py-1.5">Du</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Fund-Pins ({items.length})</h3>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">Noch keine Fund-Pins gemeldet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2 border border-gray-200 rounded-xl p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0" aria-hidden>
                    {categoryIcon(i.category)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{i.category}</p>
                    <p className="text-xs text-gray-400 truncate">{i.description || "Keine Beschreibung"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(i.id)}
                  className="shrink-0 text-xs text-red-600 font-semibold px-2.5 py-1.5 rounded-full border border-red-200 hover:bg-red-50 transition"
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
