import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

// Placeholder data model + UI for linking external training-tracker
// accounts. Real OAuth flows for these are a follow-up - for now the
// profile stores a manually-entered external account id, so the schema
// and UI are ready the moment OAuth is wired up.
const CONNECTIONS = [
  { key: "strava_id", label: "Strava", icon: "🟠" },
  { key: "komoot_id", label: "Komoot", icon: "🟢" },
  { key: "garmin_id", label: "Garmin", icon: "🔵" },
];

export default function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState("");

  if (!user) return null;

  async function handleDisconnect(key) {
    setSavingKey(key);
    setError("");
    try {
      await updateProfile({ [key]: null });
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey(null);
    }
  }

  async function handleConnect(key, label) {
    const value = window.prompt(
      `${label}-Konto verknüpfen (Platzhalter, bis die echte Anmeldung verfügbar ist):\nBitte deine ${label}-Nutzer-ID eingeben.`
    );
    if (!value) return;
    setSavingKey(key);
    setError("");
    try {
      await updateProfile({ [key]: value.trim() });
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey(null);
    }
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6 bg-white">
      <div>
        <h2 className="font-semibold text-gray-800 text-lg">Profil</h2>
        <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        {user.role === "admin" && (
          <span className="inline-block mt-2 text-xs bg-trail-50 text-trail-700 border border-trail-100 rounded-full px-2.5 py-1 font-medium">
            👑 Admin
          </span>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-1">Verknüpfte Konten</h3>
        <p className="text-xs text-gray-400 mb-3">
          Verbinde TrailFound zukünftig mit deinen Trainings-Apps, um Routen direkt zu
          importieren. (Vorbereitet - die echte Anmeldung folgt.)
        </p>
        <div className="space-y-2">
          {CONNECTIONS.map(({ key, label, icon }) => {
            const connected = Boolean(user[key]);
            const saving = savingKey === key;
            return (
              <div
                key={key}
                className="flex items-center justify-between border border-gray-200 rounded-xl p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl shrink-0" aria-hidden>
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {connected ? `Verbunden (${user[key]})` : "Nicht verbunden"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (connected ? handleDisconnect(key) : handleConnect(key, label))}
                  disabled={saving}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition disabled:opacity-50 ${
                    connected
                      ? "border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600"
                      : "border-trail-600 text-trail-700 hover:bg-trail-50"
                  }`}
                >
                  {saving ? "..." : connected ? "Trennen" : "Verbinden"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="w-full border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition"
      >
        Abmelden
      </button>
    </div>
  );
}
