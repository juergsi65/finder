import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import "../leafletIcons.js";
import { DEFAULT_CENTER } from "../constants.js";
import { categoryIcon } from "../categoryIcons.js";

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

/**
 * The app's main "browse for lost gear" surface: every found-item pin
 * plotted on an interactive map, no route upload required. `userPos` (if
 * known) is shown as a small dot so it's clear what "in deiner Nähe" is
 * relative to.
 */
export default function FoundItemsMap({ center, userPos, items, flyToTarget }) {
  return (
    <MapContainer center={center || DEFAULT_CENTER} zoom={13} className="w-full h-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo target={flyToTarget} />

      {userPos && (
        <CircleMarker
          center={userPos}
          radius={8}
          pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.9, weight: 2 }}
        />
      )}

      {items.map((item) => (
        <Marker key={item.id} position={[item.lat, item.lng]}>
          <Popup>
            <div className="min-w-[10rem]">
              <strong>
                {categoryIcon(item.category)} {item.category}
              </strong>
              {item.description && <div className="mt-0.5">{item.description}</div>}
              {typeof item.distance_m === "number" && (
                <div className="text-gray-500 mt-0.5">{formatDistance(item.distance_m)} entfernt</div>
              )}
              {item.photo_path && (
                <img
                  src={item.photo_path}
                  alt={item.category}
                  className="mt-1.5 rounded-md max-h-28 w-full object-cover"
                />
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export { formatDistance };
