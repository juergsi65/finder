import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import "../leafletIcons.js";
import CategoryPicker from "../components/CategoryPicker.jsx";
import GpxDropzone from "../components/GpxDropzone.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import ContactFinderButton from "../components/ContactFinderButton.jsx";
import Spinner from "../components/Spinner.jsx";
import { useAuth } from "../AuthContext.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import { getCategories, searchGpx, getStravaStatus, getStravaTodayTrack } from "../api.js";

const ROUTE_COLOR = "#0c7233";
const ALL = "__all__";

export default function Search() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");
  const [gpxFile, setGpxFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [strava, setStrava] = useState({ configured: false, connected: false });
  const [stravaLoading, setStravaLoading] = useState(false);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories(["Trinkflasche", "Radcomputer", "Pumpe", "Brille", "Sonstiges"]));
  }, []);

  useEffect(() => {
    if (!user) return;
    getStravaStatus()
      .then(setStrava)
      .catch(() => {});
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!gpxFile) return;
    setSubmitting(true);
    setAnalyzing(false);
    setUploadProgress(0);
    setError("");
    setResult(null);
    try {
      const res = await searchGpx({
        query,
        category: category === ALL ? undefined : category,
        gpxFile,
        onProgress: (pct) => {
          setUploadProgress(pct);
          if (pct >= 100) setAnalyzing(true);
        },
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setAnalyzing(false);
    }
  }

  async function handleStravaCheck() {
    setStravaLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await getStravaTodayTrack({
        query,
        category: category === ALL ? undefined : category,
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setStravaLoading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 bg-white">
      <div className="max-w-2xl mx-auto w-full space-y-5">
      <div>
        <h2 className="font-semibold text-slate-800 text-lg">{t("search.heading")}</h2>
        <p className="text-sm text-slate-500 mt-1">{t("search.intro")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t("search.queryLabel")}</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.queryPlaceholder")}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
          />
        </div>

        <CategoryPicker
          categories={[ALL, ...categories]}
          value={category}
          onChange={setCategory}
          label={t("search.categoryLabel")}
          allValue={ALL}
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t("search.gpxLabel")}</label>
          <GpxDropzone file={gpxFile} onFileSelected={setGpxFile} onInvalidFile={setError} />
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        {submitting && (
          <ProgressBar
            percent={analyzing ? 100 : uploadProgress}
            label={analyzing ? t("search.analyzing") : t("search.uploading")}
          />
        )}

        <button
          type="submit"
          disabled={submitting || !gpxFile}
          className="w-full bg-trail-600 disabled:bg-slate-300 hover:bg-trail-700 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          {submitting && <Spinner />}
          {submitting ? (analyzing ? t("search.analyzing") : t("search.uploading")) : t("search.submit")}
        </button>
      </form>

      <StravaAddon
        user={user}
        strava={strava}
        loading={stravaLoading}
        onCheck={handleStravaCheck}
        t={t}
      />

      <p className="text-xs text-slate-400 text-center">
        {t("search.orBrowseMap")} <Link to="/" className="text-trail-700 font-medium">🗺️</Link>
      </p>

      {result && <SearchResults result={result} />}
      </div>
    </div>
  );
}

function StravaAddon({ user, strava, loading, onCheck, t }) {
  if (!user) return null;
  if (strava.configured && !strava.connected) {
    return (
      <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
        🟠 {t("search.strava.notConnected")}
      </p>
    );
  }
  if (!strava.configured) return null;

  return (
    <button
      type="button"
      onClick={onCheck}
      disabled={loading}
      className="w-full border-2 border-orange-400 text-orange-600 disabled:opacity-60 hover:bg-orange-50 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
    >
      {loading ? <Spinner className="w-4 h-4" /> : <span aria-hidden>🟠</span>}
      {loading ? t("search.strava.checking") : t("search.strava.button")}
    </button>
  );
}

function FitToRoute({ track, matches }) {
  const map = useMap();
  useEffect(() => {
    const positions = [...track.map((p) => [p.lat, p.lng]), ...matches.map((m) => [m.item.lat, m.item.lng])];
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 16);
    } else {
      map.fitBounds(positions, { padding: [32, 32] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, matches]);
  return null;
}

function distanceBadgeClass(distance) {
  if (distance <= 10) return "bg-trail-100 text-trail-700";
  if (distance <= 20) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function SearchResults({ result }) {
  const { t } = useTranslation();
  const track = result.track_preview || [];

  if (!result.matched) {
    return (
      <div className="space-y-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 flex items-start gap-2">
          <span className="text-lg" aria-hidden>
            🔎
          </span>
          <span>
            {t("search.noMatch")} {result.track_points_checked} {t("search.noMatchDetail")} ({result.radius_m}m)
          </span>
        </div>
        {track.length > 1 && (
          <div className="h-56 rounded-xl overflow-hidden border border-slate-200">
            <MapContainer className="w-full h-full" center={[track[0].lat, track[0].lng]} zoom={13}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Polyline positions={track.map((p) => [p.lat, p.lng])} pathOptions={{ color: ROUTE_COLOR, weight: 4, opacity: 0.8 }} />
              <FitToRoute track={track} matches={[]} />
            </MapContainer>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-trail-50 border border-trail-200 rounded-xl p-4">
        <p className="font-semibold text-trail-700 flex items-center gap-2">
          <span aria-hidden>🎉</span> {t("search.matchFound")}
        </p>
        <p className="text-sm text-trail-700/80 mt-1">
          {result.matches.length} {t("search.matchCount")} {result.radius_m}m-{t("search.radiusLabel")} (
          {result.track_points_checked} {t("search.pointsChecked")}
          {result.source === "strava" && result.source_label ? ` - ${result.source_label}` : ""})
        </p>
      </div>

      <div className="h-72 rounded-xl overflow-hidden border border-slate-200">
        <MapContainer center={[result.matches[0].item.lat, result.matches[0].item.lng]} zoom={16} className="w-full h-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToRoute track={track} matches={result.matches} />

          {track.length > 1 && (
            <Polyline positions={track.map((p) => [p.lat, p.lng])} pathOptions={{ color: ROUTE_COLOR, weight: 4, opacity: 0.75 }} />
          )}

          {result.matches.map((m) => (
            <Fragment key={m.item.id}>
              <Marker position={[m.item.lat, m.item.lng]}>
                <Popup>
                  <strong>{m.item.title}</strong>
                  <div>{m.distance_m}m {t("home.away")}</div>
                  {m.item.description && <div>{m.item.description}</div>}
                </Popup>
              </Marker>
              <CircleMarker
                center={[m.matched_track_point.lat, m.matched_track_point.lng]}
                radius={5}
                pathOptions={{ color: ROUTE_COLOR, fillColor: ROUTE_COLOR, fillOpacity: 1, weight: 2 }}
              />
              <Polyline
                positions={[
                  [m.item.lat, m.item.lng],
                  [m.matched_track_point.lat, m.matched_track_point.lng],
                ]}
                pathOptions={{ color: ROUTE_COLOR, dashArray: "4 6", weight: 2, opacity: 0.9 }}
              />
            </Fragment>
          ))}
        </MapContainer>
      </div>

      <ul className="space-y-2">
        {result.matches.map((m) => (
          <li key={m.item.id} className="border border-slate-200 bg-white rounded-xl p-3 text-sm space-y-2 shadow-card">
            <div className="flex justify-between items-start gap-2">
              <span className="font-medium text-slate-800">{m.item.title}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${distanceBadgeClass(m.distance_m)}`}>
                {m.distance_m} m {t("home.away")}
              </span>
            </div>
            {m.item.description && <p className="text-slate-500">{m.item.description}</p>}
            {m.item.photo_path && (
              <img src={m.item.photo_path} alt={m.item.title} className="rounded-lg max-h-40 w-full object-cover" />
            )}
            <ContactFinderButton itemId={m.item.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
