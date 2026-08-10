import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import MapPicker from "../components/MapPicker.jsx";
import { getCategories, getFoundItems, createFoundItem } from "../api.js";

export default function FinderMode() {
  const [categories, setCategories] = useState([]);
  const [existingItems, setExistingItems] = useState([]);
  const [pin, setPin] = useState(null);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getCategories()
      .then((cats) => {
        setCategories(cats);
        setCategory((prev) => prev || cats[0]);
      })
      .catch(() => setCategories(["Trinkflasche", "Radcomputer", "Pumpe", "Brille", "Sonstiges"]));

    getFoundItems()
      .then(setExistingItems)
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pin) {
      setError("Bitte setze zuerst einen Pin auf der Karte.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const created = await createFoundItem({
        category,
        description,
        lat: pin.lat,
        lng: pin.lng,
        photo,
      });
      setExistingItems((prev) => [created, ...prev]);
      setSuccess(true);
      setPin(null);
      setDescription("");
      setPhoto(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-1/2 min-h-[220px] relative">
        <MapPicker pin={pin} onPick={setPin}>
          {existingItems.map((item) => (
            <Marker key={item.id} position={[item.lat, item.lng]}>
              <Popup>
                <strong>{item.category}</strong>
                {item.description && <div>{item.description}</div>}
              </Popup>
            </Marker>
          ))}
        </MapPicker>
        {!pin && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/95 text-sm px-3 py-1.5 rounded-full shadow z-[1000] pointer-events-none">
            Tippe auf die Karte, um einen Fund-Pin zu setzen
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        <h2 className="font-semibold text-gray-800 text-lg">Etwas gefunden</h2>

        {pin ? (
          <p className="text-sm text-trail-700 bg-trail-50 border border-trail-100 rounded-lg px-3 py-2">
            📍 Pin gesetzt bei {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
          </p>
        ) : (
          <p className="text-sm text-gray-400">Noch kein Pin gesetzt.</p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Foto (optional)</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-trail-50 file:text-trail-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500"
            rows={3}
            placeholder="z.B. blaue Trinkflasche am Wegesrand, ca. 100m nach der Brücke"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <p className="text-sm text-trail-700 bg-trail-50 border border-trail-100 rounded-lg px-3 py-2">
            ✅ Fund gespeichert - danke!
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !pin}
          className="w-full bg-trail-600 disabled:bg-gray-300 hover:bg-trail-700 text-white font-semibold py-3 rounded-xl transition"
        >
          {submitting ? "Speichere..." : "Fund melden"}
        </button>
      </form>
    </div>
  );
}
