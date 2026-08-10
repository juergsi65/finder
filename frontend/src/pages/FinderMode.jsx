import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Marker, Popup } from "react-leaflet";
import MapPicker from "../components/MapPicker.jsx";
import CategoryPicker from "../components/CategoryPicker.jsx";
import PhotoDropzone from "../components/PhotoDropzone.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import Spinner from "../components/Spinner.jsx";
import { useAuth } from "../AuthContext.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import { getCategories, getFoundItems, createFoundItem } from "../api.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinderMode() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [existingItems, setExistingItems] = useState([]);
  const [pin, setPin] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [foundDate, setFoundDate] = useState(todayIso);
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
      setError(t("finder.errors.geoUnsupported"));
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
        setError(t("finder.errors.geoFailed"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pin) {
      setError(t("finder.errors.noPin"));
      return;
    }
    if (!title.trim()) {
      setError(t("finder.errors.noTitle"));
      return;
    }
    if (!photo) {
      setError(t("finder.errors.noPhoto"));
      return;
    }
    setSubmitting(true);
    setUploadProgress(0);
    setError("");
    try {
      const created = await createFoundItem({
        title,
        category,
        description,
        lat: pin.lat,
        lng: pin.lng,
        foundDate,
        photo,
        onProgress: setUploadProgress,
      });
      setExistingItems((prev) => [created, ...prev]);
      setSuccess(true);
      setPin(null);
      setTitle("");
      setDescription("");
      setPhoto(null);
      setFoundDate(todayIso());
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  }

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-4 bg-gradient-to-b from-trail-50 to-white">
        <div className="text-4xl" aria-hidden>
          🔐
        </div>
        <p className="text-slate-600 max-w-xs">{t("finder.heading")}</p>
        <Link
          to="/login"
          state={{ from: "/gefunden" }}
          className="bg-trail-600 hover:bg-trail-700 text-white font-semibold px-5 py-3 rounded-xl transition"
        >
          {t("nav.login")}
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-[45%] min-h-[220px] relative isolate">
        <MapPicker pin={pin} onPick={setPin} flyToTarget={flyToTarget}>
          {existingItems.map((item) => (
            <Marker key={item.id} position={[item.lat, item.lng]}>
              <Popup>
                <strong>{item.title}</strong>
                {item.description && <div>{item.description}</div>}
              </Popup>
            </Marker>
          ))}
        </MapPicker>

        {!pin && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur text-sm px-3 py-1.5 rounded-full shadow-float z-[1000] pointer-events-none whitespace-nowrap">
            👆 {t("finder.tapHint")}
          </div>
        )}

        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          className="absolute bottom-3 right-3 z-[1000] bg-white shadow-float rounded-full w-11 h-11 flex items-center justify-center text-lg border border-slate-200 active:scale-95 transition disabled:opacity-60"
          aria-label={t("home.locateMe")}
        >
          {locating ? <Spinner className="w-5 h-5 text-trail-600" /> : "🎯"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 bg-white rounded-t-2xl -mt-4 relative shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
      <div className="max-w-2xl mx-auto w-full space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-lg">{t("finder.heading")}</h2>
          {pin ? (
            <span className="text-xs text-trail-700 bg-trail-50 border border-trail-100 rounded-full px-2.5 py-1 font-medium">
              📍 {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </span>
          ) : (
            <span className="text-xs text-slate-400">{t("finder.noPin")}</span>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t("finder.title")}</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("finder.titlePlaceholder")}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
          />
        </div>

        <CategoryPicker categories={categories} value={category} onChange={setCategory} label={t("finder.category")} />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t("finder.photoRequired")}</label>
          <PhotoDropzone file={photo} onFileSelected={setPhoto} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t("finder.foundDate")}</label>
          <input
            type="date"
            required
            value={foundDate}
            max={todayIso()}
            onChange={(e) => setFoundDate(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t("finder.descriptionOptional")}</label>
          <textarea
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
            rows={3}
            placeholder={t("finder.descriptionPlaceholder")}
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
            ✅ {t("finder.success")}
          </p>
        )}

        {submitting && (
          <ProgressBar percent={uploadProgress} label={photo ? t("finder.uploadingPhoto") : t("finder.saving")} />
        )}

        <button
          type="submit"
          disabled={submitting || !pin}
          className="w-full bg-trail-600 disabled:bg-slate-300 hover:bg-trail-700 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          {submitting && <Spinner />}
          {submitting ? t("finder.submitting") : t("finder.submit")}
        </button>
      </div>
      </form>
    </div>
  );
}
