import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import MapPicker from "../components/MapPicker.jsx";
import CategoryPicker from "../components/CategoryPicker.jsx";
import PhotoDropzone from "../components/PhotoDropzone.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import Spinner from "../components/Spinner.jsx";
import { getCategories, getFoundItems, createFoundItem } from "../api.js";

export default function FinderMode() {
  const [categories, setCategories] = useState([]);
  const [existingItems, setExistingItems] = useState([]);
  const [pin, setPin] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [locating, setLocating] = useState(false);
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

  function handleLocate() {
    if (!navigator.geolocation) {
      setError("Standortbestimmung wird von diesem Browser nicht unterstützt.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPin(latlng);
        setFlyToTarget([latlng.lat, latlng.lng]);
        setLocating(false);
      },
      () => {
        setError("Standort konnte nicht ermittelt werden. Bitte manuell auf der Karte tippen.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pin) {
      setError("Bitte setze zuerst einen Pin auf der Karte.");
      return;
    }
    setSubmitting(true);
    setUploadProgress(0);
    setError("");
    try {
      const created = await createFoundItem({
        category,
        description,
        lat: pin.lat,
        lng: pin.lng,
        photo,
        onProgress: setUploadProgress,
      });
      setExistingItems((prev) => [created, ...prev]);
      setSuccess(true);
      setPin(null);
      setDescription("");
      setPhoto(null);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-[45%] min-h-[220px] relative isolate">
        <MapPicker pin={pin} onPick={setPin} flyToTarget={flyToTarget}>
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
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur text-sm px-3 py-1.5 rounded-full shadow-lg z-[1000] pointer-events-none whitespace-nowrap">
            👆 Tippe auf die Karte, um einen Fund-Pin zu setzen
          </div>
        )}

        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          className="absolute bottom-3 right-3 z-[1000] bg-white shadow-lg rounded-full w-11 h-11 flex items-center justify-center text-lg border border-gray-200 active:scale-95 transition disabled:opacity-60"
          aria-label="Meinen Standort verwenden"
        >
          {locating ? <Spinner className="w-5 h-5 text-trail-600" /> : "🎯"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5 bg-white rounded-t-2xl -mt-4 relative shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-lg">Etwas gefunden</h2>
          {pin ? (
            <span className="text-xs text-trail-700 bg-trail-50 border border-trail-100 rounded-full px-2.5 py-1 font-medium">
              📍 {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Kein Pin gesetzt</span>
          )}
        </div>

        <CategoryPicker categories={categories} value={category} onChange={setCategory} label="Kategorie" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Foto</label>
          <PhotoDropzone file={photo} onFileSelected={setPhoto} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Beschreibung</label>
          <textarea
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
            rows={3}
            placeholder="z.B. blaue Trinkflasche am Wegesrand, ca. 100m nach der Brücke"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-trail-700 bg-trail-50 border border-trail-100 rounded-lg px-3 py-2">
            ✅ Fund gespeichert - danke, dass du hilfst!
          </p>
        )}

        {submitting && <ProgressBar percent={uploadProgress} label={photo ? "Foto wird hochgeladen" : "Wird gespeichert"} />}

        <button
          type="submit"
          disabled={submitting || !pin}
          className="w-full bg-trail-600 disabled:bg-gray-300 hover:bg-trail-700 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          {submitting && <Spinner />}
          {submitting ? "Speichere..." : "Fund melden"}
        </button>
      </form>
    </div>
  );
}
