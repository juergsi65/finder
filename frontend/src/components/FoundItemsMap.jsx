import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import "../leafletIcons.js";
import { buildBadgeIcon } from "../leafletIcons.js";
import { DEFAULT_CENTER } from "../constants.js";
import { resolveIcon } from "../categoryIcons.js";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import ContactFinderButton from "./ContactFinderButton.jsx";

function formatDistance(meters) {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function FlyTo({ target, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, zoom ?? Math.max(map.getZoom(), 14));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return null;
}

/** Fires `onMapClick(latlng)` for a click on open map area - clicking an
 * existing Marker/Popup never reaches this (Leaflet markers don't bubble
 * click events up to the map), so this only fires for genuinely empty
 * spots, which is exactly "open the create-something menu here". */
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng);
    },
  });
  return null;
}

// Icon instances are cheap to build but there's no reason to rebuild the
// (fixed) pin badge on every render - found/lost/stolen badges vary per
// item (different emoji) so those are memoized per-render below instead.
const pinBadgeIcon = buildBadgeIcon("📌", "pin");

/**
 * The app's main map surface - found-item, lost/stolen-report and note
 * pins all plotted together, each as a colored "signal" badge (see
 * leafletIcons.buildBadgeIcon): calm green for found, pulsing red for
 * lost/stolen so they draw the eye immediately, neutral violet for notes.
 * `userPos` (if known) is shown as a small dot so it's clear what "in
 * deiner Nähe" is relative to. Pass `onMapClick`/`onPinClick` to make the
 * map interactive (Home.jsx wires these to the action menu / PinModal).
 */
export default function FoundItemsMap({
  center,
  userPos,
  items,
  lostItems = [],
  pins = [],
  flyToTarget,
  onMapClick,
  onPinClick,
}) {
  const { t } = useTranslation();

  const foundIcons = useMemo(() => {
    const cache = new Map();
    return (item) => {
      const emoji = resolveIcon(item);
      if (!cache.has(emoji)) cache.set(emoji, buildBadgeIcon(emoji, "found"));
      return cache.get(emoji);
    };
  }, []);

  const lostIcons = useMemo(() => {
    const cache = new Map();
    return (report) => {
      const variant = report.report_type === "stolen" ? "stolen" : "lost";
      const emoji = resolveIcon(report);
      const key = `${variant}:${emoji}`;
      if (!cache.has(key)) cache.set(key, buildBadgeIcon(emoji, variant));
      return cache.get(key);
    };
  }, []);

  return (
    <MapContainer center={center || DEFAULT_CENTER} zoom={13} className="w-full h-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo target={flyToTarget} />
      {onMapClick && <ClickHandler onMapClick={onMapClick} />}

      {userPos && (
        <CircleMarker
          center={userPos}
          radius={8}
          pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.9, weight: 2 }}
        />
      )}

      {items.map((item) => (
        <Marker key={`found-${item.id}`} position={[item.lat, item.lng]} icon={foundIcons(item)}>
          <Popup minWidth={200}>
            <div className="min-w-[11rem] space-y-1.5">
              <strong>
                {resolveIcon(item)} {item.title}
              </strong>
              <div className="text-[11px] font-semibold text-trail-700 uppercase tracking-wide">{item.category}</div>
              {item.description && <div>{item.description}</div>}
              <div className="text-slate-500 text-xs">
                {t("home.foundOn")} {item.found_date}
                {typeof item.distance_m === "number" && ` - ${formatDistance(item.distance_m)} ${t("home.away")}`}
              </div>
              {item.photo_path && (
                <img src={item.photo_path} alt={item.title} className="rounded-md max-h-28 w-full object-cover" />
              )}
              <ContactFinderButton itemId={item.id} className="pt-1" />
            </div>
          </Popup>
        </Marker>
      ))}

      {lostItems.map((report) => {
        const stolen = report.report_type === "stolen";
        return (
          <Marker key={`lost-${report.id}`} position={[report.lat, report.lng]} icon={lostIcons(report)}>
            <Popup minWidth={200}>
              <div className="min-w-[11rem] space-y-1.5">
                <span
                  className={`inline-block text-[11px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                    stolen ? "bg-red-100 text-red-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {stolen ? t("lost.typeStolen") : t("lost.typeLost")}
                </span>
                <strong className="block">
                  {resolveIcon(report)} {report.title}
                </strong>
                <div className="text-slate-500 text-xs">{report.category}</div>
                {report.description && <div>{report.description}</div>}
                {report.serial_number && (
                  <div className="text-xs text-slate-500">
                    {t("lost.serialNumber")}: {report.serial_number}
                  </div>
                )}
                {report.photo_path && (
                  <img src={report.photo_path} alt={report.title} className="rounded-md max-h-28 w-full object-cover" />
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {pins.map((pin) => (
        <Marker
          key={`pin-${pin.id}`}
          position={[pin.lat, pin.lng]}
          icon={pinBadgeIcon}
          eventHandlers={onPinClick ? { click: () => onPinClick(pin) } : undefined}
        />
      ))}
    </MapContainer>
  );
}

export { formatDistance };
