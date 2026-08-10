import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import { getStravaStatus, getStravaConnectUrl, disconnectStrava } from "../api.js";
import Spinner from "../components/Spinner.jsx";
import MapPicker from "../components/MapPicker.jsx";
import LegalFooter from "../components/LegalFooter.jsx";

// Manual placeholders for future external-service linking without OAuth yet.
const MANUAL_CONNECTIONS = [
  { key: "komoot_id", label: "Komoot", icon: "🟢" },
  { key: "garmin_id", label: "Garmin", icon: "🔵" },
];

export default function Profile() {
  const { user, updateProfile, logout, refreshUser } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [strava, setStrava] = useState({ configured: false, connected: user?.strava_connected || false });
  const [stravaBusy, setStravaBusy] = useState(false);

  const [alertOptIn, setAlertOptIn] = useState(Boolean(user?.alert_opt_in));
  const [homePin, setHomePin] = useState(
    user?.home_lat != null && user?.home_lng != null ? { lat: user.home_lat, lng: user.home_lng } : null
  );
  const [showMap, setShowMap] = useState(false);
  const [locationDirty, setLocationDirty] = useState(false);
  const [alertsBusy, setAlertsBusy] = useState(false);

  useEffect(() => {
    getStravaStatus()
      .then(setStrava)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const status = searchParams.get("strava");
    if (!status) return;
    if (status === "connected") {
      setNotice(t("profile.saved"));
      refreshUser();
      getStravaStatus().then(setStrava).catch(() => {});
    } else if (status === "error") {
      setError(t("profile.stravaConnectError"));
    }
    searchParams.delete("strava");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  async function handleConnectStrava() {
    setStravaBusy(true);
    setError("");
    try {
      const { authorize_url } = await getStravaConnectUrl();
      window.location.href = authorize_url;
    } catch (err) {
      setError(err.message);
      setStravaBusy(false);
    }
  }

  async function handleDisconnectStrava() {
    setStravaBusy(true);
    setError("");
    try {
      await disconnectStrava();
      setStrava((prev) => ({ ...prev, connected: false }));
      refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setStravaBusy(false);
    }
  }

  async function handleSaveDisplayName(e) {
    e.preventDefault();
    setSavingKey("display_name");
    setError("");
    setNotice("");
    try {
      await updateProfile({ display_name: displayName.trim() || null });
      setNotice(t("profile.saved"));
      setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey(null);
    }
  }

  async function handleManualConnect(key, label) {
    const value = window.prompt(`${label}-ID (Platzhalter, bis die echte Anmeldung verfügbar ist):`);
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

  async function handleManualDisconnect(key) {
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

  function handleLogout() {
    logout();
    navigate("/");
  }

  async function handleToggleAlertOptIn() {
    const next = !alertOptIn;
    setAlertOptIn(next);
    setAlertsBusy(true);
    setError("");
    try {
      await updateProfile({ alert_opt_in: next });
      setNotice(t("profile.saved"));
      setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      setAlertOptIn(!next); // revert on failure
      setError(err.message);
    } finally {
      setAlertsBusy(false);
    }
  }

  function handlePickHomeLocation(latlng) {
    setHomePin(latlng);
    setLocationDirty(true);
  }

  async function handleSaveLocation() {
    if (!homePin) return;
    setAlertsBusy(true);
    setError("");
    try {
      await updateProfile({ home_lat: homePin.lat, home_lng: homePin.lng });
      setLocationDirty(false);
      setNotice(t("profile.saved"));
      setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setAlertsBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 bg-white">
    <div className="max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h2 className="font-semibold text-slate-800 text-lg">{t("profile.heading")}</h2>
        <p className="text-sm text-slate-500 mt-1">{user.email}</p>
        <span className="inline-block mt-2 text-xs bg-trail-50 text-trail-700 border border-trail-100 rounded-full px-2.5 py-1 font-medium">
          {user.role === "admin" ? "👑 " : user.role === "verein" ? "🏔️ " : "🧑 "}
          {t(`roles.${user.role}`)}
        </span>
      </div>

      <form onSubmit={handleSaveDisplayName} className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">{t("profile.displayName")}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("profile.displayNamePlaceholder")}
            className="flex-1 border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={savingKey === "display_name"}
            className="bg-trail-600 hover:bg-trail-700 disabled:bg-slate-300 text-white font-semibold px-4 rounded-xl transition"
          >
            {savingKey === "display_name" ? <Spinner /> : t("profile.save")}
          </button>
        </div>
      </form>

      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-1">{t("profile.connections")}</h3>
        <p className="text-xs text-slate-400 mb-3">{t("profile.connectionsHint")}</p>

        <div className="space-y-2">
          {/* Strava - real OAuth */}
          <div className="flex items-center justify-between border border-slate-200 bg-white rounded-xl p-3 shadow-card">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl shrink-0" aria-hidden>
                🟠
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">Strava</p>
                <p className="text-xs text-slate-400 truncate">
                  {!strava.configured
                    ? t("profile.stravaUnavailable")
                    : strava.connected
                    ? t("profile.connected")
                    : t("profile.notConnected")}
                </p>
              </div>
            </div>
            {strava.connected ? (
              <button
                type="button"
                onClick={handleDisconnectStrava}
                disabled={stravaBusy}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600 transition disabled:opacity-50"
              >
                {stravaBusy ? "..." : t("profile.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectStrava}
                disabled={stravaBusy || !strava.configured}
                title={!strava.configured ? t("profile.stravaUnavailableTitle") : undefined}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-trail-600 text-trail-700 hover:bg-trail-50 transition disabled:opacity-40 disabled:border-slate-200 disabled:text-slate-400"
              >
                {stravaBusy ? "..." : t("profile.connect")}
              </button>
            )}
          </div>

          {MANUAL_CONNECTIONS.map(({ key, label, icon }) => {
            const connected = Boolean(user[key]);
            const saving = savingKey === key;
            return (
              <div key={key} className="flex items-center justify-between border border-slate-200 bg-white rounded-xl p-3 shadow-card">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl shrink-0" aria-hidden>
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {connected ? `${t("profile.connected")} (${user[key]})` : t("profile.notConnected")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (connected ? handleManualDisconnect(key) : handleManualConnect(key, label))}
                  disabled={saving}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition disabled:opacity-50 ${
                    connected
                      ? "border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600"
                      : "border-trail-600 text-trail-700 hover:bg-trail-50"
                  }`}
                >
                  {saving ? "..." : connected ? t("profile.disconnect") : t("profile.connect")}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl p-3 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">{t("profile.alertsHeading")}</h3>
          <span aria-hidden>🚨</span>
        </div>
        <p className="text-xs text-slate-400">{t("profile.alertsHint")}</p>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={alertOptIn}
            onChange={handleToggleAlertOptIn}
            disabled={alertsBusy}
            className="w-4 h-4 shrink-0 rounded border-slate-300 text-trail-600 focus:ring-trail-500"
          />
          <span className="text-sm text-slate-700">{t("profile.alertOptInLabel")}</span>
        </label>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            {homePin ? `📍 ${t("profile.homeLocationSet")}` : t("profile.homeLocationNotSet")}
          </p>
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-trail-300 hover:text-trail-700 transition"
          >
            {showMap ? t("profile.hideMap") : t("profile.pickOnMap")}
          </button>
        </div>

        {showMap && (
          <div className="space-y-2">
            <div className="h-56 rounded-xl overflow-hidden border border-slate-200">
              <MapPicker pin={homePin} onPick={handlePickHomeLocation} center={homePin ? [homePin.lat, homePin.lng] : undefined} />
            </div>
            <button
              type="button"
              onClick={handleSaveLocation}
              disabled={!locationDirty || alertsBusy}
              className="w-full bg-trail-600 hover:bg-trail-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
            >
              {alertsBusy ? <Spinner /> : t("profile.saveLocation")}
            </button>
          </div>
        )}
      </div>

      {notice && <p className="text-sm text-trail-700 bg-trail-50 border border-trail-100 rounded-lg px-3 py-2">{notice}</p>}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <button
        type="button"
        onClick={handleLogout}
        className="w-full border border-slate-300 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 transition"
      >
        {t("profile.logout")}
      </button>

      <LegalFooter />
    </div>
    </div>
  );
}
