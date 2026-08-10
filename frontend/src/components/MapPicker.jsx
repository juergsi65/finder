import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "../leafletIcons.js";
import { pendingIcon } from "../leafletIcons.js";

const DEFAULT_CENTER = [48.1372, 11.5754]; // Munich, just as a sensible default

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng);
    },
  });
  return null;
}

/**
 * Interactive map used in Finder-Mode: click anywhere to drop/move a pin.
 * `pin` is {lat, lng} or null. `children` can render extra markers
 * (e.g. existing found-item pins).
 */
export default function MapPicker({ pin, onPick, center, children }) {
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
      {pin && <Marker position={[pin.lat, pin.lng]} icon={pendingIcon} />}
      {children}
    </MapContainer>
  );
}

export { DEFAULT_CENTER };
