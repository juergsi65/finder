import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import "../leafletIcons.js";
import { notePinIcon } from "../leafletIcons.js";
import { DEFAULT_CENTER } from "../constants.js";
import { categoryIcon } from "../categoryIcons.js";
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
 * spots, which is exactly "drop a new pin here". */
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng);
    },
  });
  return null;
}

/**
 * The app's main "browse for lost gear" surface: every found-item pin
 * plotted on an interactive map, no route upload required. `userPos` (if
 * known) is shown as a small dot so it's clear what "in deiner Nähe" is
 * relative to. `pins` (optional) overlays free-form note pins; pass
 * `onMapClick`/`onPinClick` to make the map interactive (Home.jsx wires
 * these to open PinModal in create/view mode).
 */
export default function FoundItemsMap({ center, userPos, items, pins = [], flyToTarget, onMapClick, onPinClick }) {
  const { t } = useTranslation();

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
        <Marker key={item.id} position={[item.lat, item.lng]}>
          <Popup minWidth={200}>
            <div className="min-w-[11rem] space-y-1.5">
              <strong>
                {categoryIcon(item.category)} {item.title}
              </strong>
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

      {pins.map((pin) => (
        <Marker
          key={`pin-${pin.id}`}
          position={[pin.lat, pin.lng]}
          icon={notePinIcon}
          eventHandlers={onPinClick ? { click: () => onPinClick(pin) } : undefined}
        />
      ))}
    </MapContainer>
  );
}

export { formatDistance };
