import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "../leafletIcons.js";
import { pendingIcon } from "../leafletIcons.js";
import { DEFAULT_CENTER } from "../constants.js";

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng);
    },
  });
  return null;
}

// Smoothly pans/zooms to `target` ([lat, lng]) whenever it changes, e.g.
// after a successful geolocation lookup. Doesn't touch the view otherwise.
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, Math.max(map.getZoom(), 16));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return null;
}

/**
 * Interactive map used in Finder-Mode: click anywhere to drop/move a pin.
 * `pin` is {lat, lng} or null. `children` can render extra markers
 * (e.g. existing found-item pins). `flyToTarget` is an optional [lat, lng]
 * to animate the view to (e.g. from a "use my location" button).
 */
export default function MapPicker({ pin, onPick, center, flyToTarget, children }) {
  return (
    <MapContainer
      center={center || (pin ? [pin.lat, pin.lng] : DEFAULT_CENTER)}
      zoom={15}
      className="w-full h-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      <FlyTo target={flyToTarget} />
      {pin && <Marker position={[pin.lat, pin.lng]} icon={pendingIcon} />}
      {children}
    </MapContainer>
  );
}
