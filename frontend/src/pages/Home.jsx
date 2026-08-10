import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FoundItemsMap from "../components/FoundItemsMap.jsx";
import TopLoadingBar from "../components/TopLoadingBar.jsx";
import Spinner from "../components/Spinner.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import { getCategories, getFoundItems } from "../api.js";
import { categoryIcon } from "../categoryIcons.js";
import { DEFAULT_CENTER, NEARBY_RADIUS_M } from "../constants.js";

const ALL_CATEGORIES = "__all__";

export default function Home() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [userPos, setUserPos] = useState(null);
  const [locating, setLocating] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [flyToTarget, setFlyToTarget] = useState(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories(["Trinkflasche", "Radcomputer", "Pumpe", "Brille", "Sonstiges"]));
  }, []);

  useEffect(() => {
    loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadEverything() {
    setLocating(true);
    setLoadingItems(true);
    setError("");

    function fetchItemsFor(pos) {
      setUserPos(pos);
      setLocating(false);
      getFoundItems(pos ? { lat: pos[0], lng: pos[1] } : {})
        .then(setItems)
        .catch((err) => setError(err.message))
        .finally(() => setLoadingItems(false));
    }

    if (!navigator.geolocation) {
      fetchItemsFor(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchItemsFor([pos.coords.latitude, pos.coords.longitude]),
      () => fetchItemsFor(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleLocate() {
    setLocating(true);
    if (!navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const target = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(target);
        setFlyToTarget(target);
        setLocating(false);
        setLoadingItems(true);
        getFoundItems({ lat: target[0], lng: target[1] })
          .then(setItems)
          .catch((err) => setError(err.message))
          .finally(() => setLoadingItems(false));
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  const filteredItems = useMemo(
    () => (categoryFilter === ALL_CATEGORIES ? items : items.filter((i) => i.category === categoryFilter)),
    [items, categoryFilter]
  );

  const nearbyCount = useMemo(() => {
    if (!userPos) return null;
    return items.filter((i) => typeof i.distance_m === "number" && i.distance_m <= NEARBY_RADIUS_M).length;
  }, [items, userPos]);

  return (
    <div className="h-full flex flex-col relative isolate">
      <TopLoadingBar active={locating || loadingItems} />

      <FoundItemsMap
        center={userPos || DEFAULT_CENTER}
        userPos={userPos}
        items={filteredItems}
        flyToTarget={flyToTarget}
      />

      {/* Nearby-count banner + category filter, floating over the map */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-float px-4 py-3">
          {locating ? (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Spinner className="w-4 h-4 text-trail-600" /> {t("home.locating")}
            </p>
          ) : userPos ? (
            <p className="text-sm text-slate-800">
              <span className="text-lg font-bold text-trail-700">{loadingItems ? "…" : nearbyCount}</span>{" "}
              {t("home.nearbyCount")} <span className="text-slate-400">({Math.round(NEARBY_RADIUS_M / 1000)} km)</span>
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              {t("home.noLocation")}{" "}
              <span className="font-semibold text-trail-700">{loadingItems ? "…" : items.length}</span>{" "}
              {t("home.reportedPins")}
            </p>
          )}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <FilterChip
            active={categoryFilter === ALL_CATEGORIES}
            onClick={() => setCategoryFilter(ALL_CATEGORIES)}
            icon="🗺️"
            label={t("home.all")}
          />
          {categories.map((c) => (
            <FilterChip
              key={c}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
              icon={categoryIcon(c)}
              label={t(`categories.${c}`)}
            />
          ))}
        </div>
      </div>

      {/* Floating actions */}
      <button
        type="button"
        onClick={handleLocate}
        className="absolute bottom-24 right-3 z-[1000] bg-white shadow-float rounded-full w-11 h-11 flex items-center justify-center text-lg border border-slate-200 active:scale-95 transition"
        aria-label={t("home.locateMe")}
      >
        🎯
      </button>

      <Link
        to="/suche"
        className="absolute bottom-24 left-3 z-[1000] bg-white hover:bg-slate-50 text-trail-700 border border-trail-600 font-semibold rounded-full shadow-float px-4 py-3 flex items-center gap-2 active:scale-95 transition"
      >
        <span aria-hidden>🔍</span> {t("nav.search")}
      </Link>

      <Link
        to="/gefunden"
        className="absolute bottom-5 right-3 z-[1000] bg-trail-600 hover:bg-trail-700 text-white font-semibold rounded-full shadow-float px-4 py-3 flex items-center gap-2 active:scale-95 transition"
      >
        <span aria-hidden>📍</span> {t("home.reportButton")}
      </Link>
    </div>
  );
}

function FilterChip({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border shadow-sm transition ${
        active ? "bg-trail-600 border-trail-600 text-white" : "bg-white/95 border-slate-200 text-slate-700 hover:border-trail-300"
      }`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}
