import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FoundItemsMap from "../components/FoundItemsMap.jsx";
import TopLoadingBar from "../components/TopLoadingBar.jsx";
import Spinner from "../components/Spinner.jsx";
import OnboardingModal from "../components/OnboardingModal.jsx";
import PinModal from "../components/PinModal.jsx";
import MapActionMenu from "../components/MapActionMenu.jsx";
import LayerPanel from "../components/LayerPanel.jsx";
import LiveFeedPanel from "../components/LiveFeedPanel.jsx";
import { useAuth } from "../AuthContext.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import { getCategories, getFoundItems, getLostItems, getPins } from "../api.js";
import { resolveIcon } from "../categoryIcons.js";
import { DEFAULT_CENTER, NEARBY_RADIUS_M } from "../constants.js";

const ONBOARDING_SEEN_KEY = "trailfound_onboarding_seen";

export default function Home() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [lostItems, setLostItems] = useState([]);
  const [pins, setPins] = useState([]);
  const [pinModal, setPinModal] = useState(null);
  const [mapMenuAt, setMapMenuAt] = useState(null);
  const [showLayers, setShowLayers] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [locating, setLocating] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState("");
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // "Hidden set" model (nothing hidden by default) for both axes, so newly
  // loaded categories/types are visible automatically without this needing
  // to know about them in advance.
  const [hiddenTypes, setHiddenTypes] = useState(() => new Set());
  const [hiddenCategories, setHiddenCategories] = useState(() => new Set());

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories(["Trinkflasche", "Radcomputer", "Pumpe", "Brille", "Sonstiges"]));
  }, []);

  useEffect(() => {
    getPins()
      .then(setPins)
      .catch(() => {});
    getLostItems()
      .then(setLostItems)
      .catch(() => {});
  }, []);

  function handleMapClick(latlng) {
    setMapMenuAt(latlng);
  }

  function handleNote(latlng) {
    if (!user) {
      setError(t("pin.loginRequired"));
      setTimeout(() => setError((prev) => (prev === t("pin.loginRequired") ? "" : prev)), 3500);
      return;
    }
    setPinModal({ mode: "create", lat: latlng.lat, lng: latlng.lng });
  }

  function handlePinClick(pin) {
    setPinModal({ mode: "view", pin });
  }

  function handlePinCreated(created) {
    setPins((prev) => [created, ...prev]);
    setPinModal(null);
  }

  function handlePinUpdated(updated) {
    setPins((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setPinModal({ mode: "view", pin: updated });
  }

  function handlePinDeleted(id) {
    setPins((prev) => prev.filter((p) => p.id !== id));
    setPinModal(null);
  }

  // Alpha-testers see the 3-step "how it works" guide once, automatically;
  // anyone can reopen it anytime via the "?" button on the banner.
  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_SEEN_KEY)) {
      setShowOnboarding(true);
    }
  }, []);

  function dismissOnboarding() {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
    setShowOnboarding(false);
  }

  useEffect(() => {
    loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadEverything() {
    setLocating(true);
    setLoadingItems(true);
    setError("");

    // Found items load immediately, independent of geolocation - the map
    // must never sit empty just because the browser hasn't resolved (or
    // never will resolve, e.g. permission denied, no provider, or a
    // browser that silently drops the request instead of firing either
    // callback) a location. `lat`/`lng` only change the *order* the
    // backend returns items in (nearest-first) plus a `distance_m`
    // annotation - never which items come back - so if geolocation
    // resolves after this plain fetch, re-fetching with position and
    // overwriting `items` is a safe "last write wins": at worst a brief
    // re-sort, never a data loss or a stuck-empty map.
    getFoundItems({})
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingItems(false));

    function fetchItemsFor(pos) {
      setUserPos(pos);
      setLocating(false);
      if (!pos) return;
      setLoadingItems(true);
      getFoundItems({ lat: pos[0], lng: pos[1] })
        .then(setItems)
        .catch((err) => setError(err.message))
        .finally(() => setLoadingItems(false));
    }

    if (!navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchItemsFor([pos.coords.latitude, pos.coords.longitude]),
      () => setLocating(false),
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

  function toggleType(key) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCategory(name) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // Category list + counts for the layer panel, built from whatever's
  // actually loaded right now (found + lost/stolen combined) rather than
  // the full suggestion list from getCategories(), so it only ever shows
  // filters that currently do something.
  const categoryStats = useMemo(() => {
    const stats = new Map();
    function tally(list) {
      for (const entry of list) {
        const name = entry.category;
        if (!name) continue;
        const prev = stats.get(name);
        if (prev) prev.count += 1;
        else stats.set(name, { name, icon: resolveIcon(entry), count: 1 });
      }
    }
    tally(items);
    tally(lostItems);
    return [...stats.values()].sort((a, b) => b.count - a.count);
  }, [items, lostItems]);

  const typeCounts = useMemo(
    () => ({
      found: items.length,
      lost: lostItems.filter((r) => r.report_type === "lost").length,
      stolen: lostItems.filter((r) => r.report_type === "stolen").length,
      pins: pins.length,
    }),
    [items, lostItems, pins]
  );

  const visibleItems = useMemo(() => {
    if (hiddenTypes.has("found")) return [];
    return items.filter((i) => !hiddenCategories.has(i.category));
  }, [items, hiddenTypes, hiddenCategories]);

  const visibleLostItems = useMemo(() => {
    return lostItems.filter((r) => {
      if (hiddenTypes.has(r.report_type)) return false;
      if (hiddenCategories.has(r.category)) return false;
      return true;
    });
  }, [lostItems, hiddenTypes, hiddenCategories]);

  const visiblePins = useMemo(() => (hiddenTypes.has("pins") ? [] : pins), [pins, hiddenTypes]);

  const nearbyCount = useMemo(() => {
    if (!userPos) return null;
    return items.filter((i) => typeof i.distance_m === "number" && i.distance_m <= NEARBY_RADIUS_M).length;
  }, [items, userPos]);

  const activeFilterCount = hiddenTypes.size + hiddenCategories.size;

  return (
    <div className="h-full flex flex-col relative isolate">
      <TopLoadingBar active={locating || loadingItems} />

      <FoundItemsMap
        center={userPos || DEFAULT_CENTER}
        userPos={userPos}
        items={visibleItems}
        lostItems={visibleLostItems}
        pins={visiblePins}
        flyToTarget={flyToTarget}
        onMapClick={handleMapClick}
        onPinClick={handlePinClick}
      />

      {/* Overlay layer - centered to a phone-width column on large screens so
          the floating UI doesn't sprawl edge-to-edge on wide desktops. */}
      <div className="absolute inset-0 z-[1000] flex justify-center pointer-events-none">
        <div className="relative w-full max-w-3xl h-full">
          {/* Nearby-count banner, floating over the map */}
          <div className="absolute top-3 left-3 right-3 flex flex-col gap-2 pointer-events-auto">
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-float px-4 py-3 flex items-start gap-2">
              <div className="min-w-0 flex-1">
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
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="shrink-0 w-7 h-7 rounded-full border border-slate-200 text-slate-400 hover:text-trail-700 hover:border-trail-300 flex items-center justify-center text-sm transition"
                aria-label={t("home.onboarding.reopen")}
                title={t("home.onboarding.reopen")}
              >
                ?
              </button>
            </div>
          </div>

          {/* Floating actions */}
          <button
            type="button"
            onClick={() => setShowLayers(true)}
            className="absolute top-24 right-3 pointer-events-auto bg-white shadow-float rounded-full w-11 h-11 flex items-center justify-center text-lg border border-slate-200 active:scale-95 transition"
            aria-label={t("layers.heading")}
            title={t("layers.heading")}
          >
            🗂️
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-trail-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {user && (
            <button
              type="button"
              onClick={() => setShowFeed(true)}
              className="absolute top-24 left-3 pointer-events-auto bg-white shadow-float rounded-full w-11 h-11 flex items-center justify-center text-lg border border-slate-200 active:scale-95 transition"
              aria-label={t("feed.heading")}
              title={t("feed.heading")}
            >
              💬
            </button>
          )}

          <button
            type="button"
            onClick={handleLocate}
            className="absolute bottom-5 right-3 pointer-events-auto bg-white shadow-float rounded-full w-11 h-11 flex items-center justify-center text-lg border border-slate-200 active:scale-95 transition"
            aria-label={t("home.locateMe")}
          >
            🎯
          </button>

          <Link
            to="/suche"
            className="absolute bottom-5 right-16 pointer-events-auto bg-white shadow-float rounded-full w-11 h-11 flex items-center justify-center text-lg border border-slate-200 active:scale-95 transition"
            aria-label={t("nav.search")}
            title={t("nav.search")}
          >
            🔍
          </Link>

          <div className="absolute bottom-5 left-3 pointer-events-auto bg-white/95 backdrop-blur text-xs text-slate-500 rounded-full shadow-float px-3.5 py-2.5 flex items-center gap-1.5">
            <span aria-hidden>👆</span> {t("home.tapMapHint")}
          </div>
        </div>
      </div>

      {showOnboarding && <OnboardingModal onClose={dismissOnboarding} />}

      {mapMenuAt && <MapActionMenu latlng={mapMenuAt} onClose={() => setMapMenuAt(null)} onNote={handleNote} />}

      {showLayers && (
        <LayerPanel
          counts={typeCounts}
          hiddenTypes={hiddenTypes}
          onToggleType={toggleType}
          categories={categoryStats}
          hiddenCategories={hiddenCategories}
          onToggleCategory={toggleCategory}
          onResetCategories={() => setHiddenCategories(new Set())}
          onClose={() => setShowLayers(false)}
        />
      )}

      {showFeed && <LiveFeedPanel onClose={() => setShowFeed(false)} />}

      {pinModal && (
        <PinModal
          pin={pinModal.mode === "view" ? pinModal.pin : null}
          createAt={pinModal.mode === "create" ? { lat: pinModal.lat, lng: pinModal.lng } : null}
          onClose={() => setPinModal(null)}
          onCreated={handlePinCreated}
          onUpdated={handlePinUpdated}
          onDeleted={handlePinDeleted}
        />
      )}
    </div>
  );
}
