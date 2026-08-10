import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "../leafletIcons.js";
import { getCategories, matchGpx } from "../api.js";

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
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-white">
      <h2 className="font-semibold text-gray-800 text-lg">Etwas verloren</h2>
      <p className="text-sm text-gray-500">
        Lade den GPS-Track deiner Tour hoch. Wir prüfen, ob in der Nähe deiner Route (30m
        Radius) etwas gemeldet wurde.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Verlorene Kategorie
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-trail-500"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GPX-Track deiner Route
          </label>
          <input
            type="file"
            accept=".gpx"
            onChange={(e) => setGpxFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-trail-50 file:text-trail-700"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !gpxFile}
          className="w-full bg-trail-600 disabled:bg-gray-300 hover:bg-trail-700 text-white font-semibold py-3 rounded-xl transition"
        >
          {submitting ? "Gleiche ab..." : "Route abgleichen"}
        </button>
      </form>

      {result && <MatchResults result={result} category={category} />}
    </div>
  );
}

function MatchResults({ result, category }) {
  if (!result.matched) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        Kein Treffer. {result.track_points_checked} Streckenpunkte geprüft, nichts im{" "}
        {result.radius_m}m-Radius gefunden.
      </div>
    );
  }

  const first = result.matches[0];

  return (
    <div className="space-y-3">
      <div className="bg-trail-50 border border-trail-200 rounded-xl p-4">
        <p className="font-semibold text-trail-700">
          🎉 Treffer! Eine {category} wurde in der Nähe deiner Route gefunden.
        </p>
        <p className="text-sm text-trail-700/80 mt-1">
          {result.matches.length} passende Fund-Pin(s) im {result.radius_m}m-Radius (
          {result.track_points_checked} Streckenpunkte geprüft).
        </p>
      </div>

      <div className="h-64 rounded-xl overflow-hidden border border-gray-200">
        <MapContainer center={[first.item.lat, first.item.lng]} zoom={16} className="w-full h-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {result.matches.map((m) => (
            <Marker key={m.item.id} position={[m.item.lat, m.item.lng]}>
              <Popup>
                <strong>{m.item.category}</strong>
                <div>{m.distance_m}m von deiner Route entfernt</div>
                {m.item.description && <div>{m.item.description}</div>}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <ul className="space-y-2">
        {result.matches.map((m) => (
          <li key={m.item.id} className="border border-gray-200 rounded-lg p-3 text-sm">
            <div className="flex justify-between items-start">
              <span className="font-medium">{m.item.category}</span>
              <span className="text-trail-700 font-semibold">{m.distance_m} m</span>
            </div>
            {m.item.description && <p className="text-gray-500 mt-1">{m.item.description}</p>}
            {m.item.photo_path && (
              <img
                src={m.item.photo_path}
                alt={m.item.category}
                className="mt-2 rounded-lg max-h-40 object-cover"
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
