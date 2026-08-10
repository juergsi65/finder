import { Fragment, useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import "../leafletIcons.js";
import CategoryPicker from "../components/CategoryPicker.jsx";
import GpxDropzone from "../components/GpxDropzone.jsx";
import Spinner from "../components/Spinner.jsx";
import { getCategories, matchGpx } from "../api.js";

const ROUTE_COLOR = "#0c7233";

export default function SeekerMode() {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [gpxFile, setGpxFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    getCategories()
      .then((cats) => {
        setCategories(cats);
        setCategory((prev) => prev || cats[0]);
      })
      .catch(() => setCategories(["Trinkflasche", "Radcomputer", "Pumpe", "Brille", "Sonstiges"]));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!gpxFile) {
      setError("Bitte lade zuerst eine GPX-Datei hoch.");
      return;
    }
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const res = await matchGpx({ category, gpxFile });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5 bg-white">
      <div>
        <h2 className="font-semibold text-gray-800 text-lg">Etwas verloren</h2>
        <p className="text-sm text-gray-500 mt-1">
          Lade den GPS-Track deiner Tour hoch. Wir prüfen jeden Meter deiner Route - auch
          zwischen den aufgezeichneten Punkten - auf Fund-Pins im 30m-Radius.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <CategoryPicker
          categories={categories}
          value={category}
          onChange={setCategory}
          label="Verlorene Kategorie"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            GPX-Track deiner Route
          </label>
          <GpxDropzone file={gpxFile} onFileSelected={setGpxFile} onInvalidFile={setError} />
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !gpxFile}
          className="w-full bg-trail-600 disabled:bg-gray-300 hover:bg-trail-700 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          {submitting && <Spinner />}
          {submitting ? "Gleiche Route ab..." : "Route abgleichen"}
        </button>
      </form>

      {result && <MatchResults result={result} category={category} />}
    </div>
  );
}

function FitToRoute({ track, matches }) {
  const map = useMap();
  useEffect(() => {
    const positions = [
      ...track.map((p) => [p.lat, p.lng]),
      ...matches.map((m) => [m.item.lat, m.item.lng]),
    ];
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
  return "bg-gray-100 text-gray-600";
}

function MatchResults({ result, category }) {
  const track = result.track_preview || [];

  if (!result.matched) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 flex items-start gap-2">
          <span className="text-lg" aria-hidden>
            🔎
          </span>
          <span>
            Kein Treffer. {result.track_points_checked} Streckenpunkte geprüft, nichts im{" "}
            {result.radius_m}m-Radius um deine Route gefunden.
          </span>
        </div>
        {track.length > 1 && (
          <div className="h-56 rounded-xl overflow-hidden border border-gray-200">
            <MapContainer className="w-full h-full" center={[track[0].lat, track[0].lng]} zoom={13}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Polyline
                positions={track.map((p) => [p.lat, p.lng])}
                pathOptions={{ color: ROUTE_COLOR, weight: 4, opacity: 0.8 }}
              />
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
          <span aria-hidden>🎉</span> Treffer! „{category}" wurde in der Nähe deiner Route
          gefunden.
        </p>
        <p className="text-sm text-trail-700/80 mt-1">
          {result.matches.length} passende Fund-Pin(s) im {result.radius_m}m-Radius (
          {result.track_points_checked} Streckenpunkte geprüft).
        </p>
      </div>

      <div className="h-72 rounded-xl overflow-hidden border border-gray-200">
        <MapContainer center={[result.matches[0].item.lat, result.matches[0].item.lng]} zoom={16} className="w-full h-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToRoute track={track} matches={result.matches} />

          {track.length > 1 && (
            <Polyline
              positions={track.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: ROUTE_COLOR, weight: 4, opacity: 0.75 }}
            />
          )}

          {result.matches.map((m) => (
            <Fragment key={m.item.id}>
              <Marker position={[m.item.lat, m.item.lng]}>
                <Popup>
                  <strong>{m.item.category}</strong>
                  <div>{m.distance_m}m von deiner Route entfernt</div>
                  {m.item.description && <div>{m.item.description}</div>}
                </Popup>
              </Marker>
              {/* Closest point on the route itself, and a dashed line showing
                  the perpendicular distance to the pin - makes the match
                  precise and understandable at a glance. */}
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
          <li key={m.item.id} className="border border-gray-200 rounded-xl p-3 text-sm">
            <div className="flex justify-between items-start gap-2">
              <span className="font-medium text-gray-800">{m.item.category}</span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${distanceBadgeClass(
                  m.distance_m
                )}`}
              >
                {m.distance_m} m entfernt
              </span>
            </div>
            {m.item.description && <p className="text-gray-500 mt-1">{m.item.description}</p>}
            {m.item.photo_path && (
              <img
                src={m.item.photo_path}
                alt={m.item.category}
                className="mt-2 rounded-lg max-h-40 w-full object-cover"
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
