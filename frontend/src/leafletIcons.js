// Vite doesn't resolve Leaflet's default marker image URLs out of the box,
// so we import the bundled PNGs directly (works offline, no CDN dependency).
import L from "leaflet";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

export const defaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export const pendingIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [30, 49],
  iconAnchor: [15, 49],
  popupAnchor: [1, -40],
  shadowSize: [49, 49],
  className: "hue-rotate-90",
});

// Free-form note pins (see Pin model) - visually distinct (violet tint)
// from the default blue found-item markers and the pending/picker marker.
export const notePinIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "hue-rotate-180 saturate-150",
});

L.Marker.prototype.options.icon = defaultIcon;

// `emoji` is user-supplied free text (see backend's validate_icon_value,
// which only checks length) - L.divIcon renders its `html` as raw DOM, so
// this MUST be escaped before interpolation or a crafted "icon" value
// becomes a stored-XSS payload rendered to every visitor of the map.
function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

const BADGE_SIZE = 38;

/**
 * Colored, optionally-pulsing circular map marker with an emoji centered
 * in it - the "signal" markers for the main map: found items (calm,
 * trail-green), lost/stolen reports (red family, animated to draw the
 * eye), and note pins (neutral). Styling lives in index.css's
 * `.map-badge*` rules since CSS keyframe animations can't be expressed
 * as Tailwind utility classes alone.
 */
export function buildBadgeIcon(emoji, variant = "found") {
  return L.divIcon({
    html: `<div class="map-badge map-badge--${variant}"><span>${escapeHtml(emoji || "📦")}</span></div>`,
    className: "map-badge-wrapper",
    iconSize: [BADGE_SIZE, BADGE_SIZE],
    iconAnchor: [BADGE_SIZE / 2, BADGE_SIZE / 2],
    popupAnchor: [0, -BADGE_SIZE / 2 - 2],
  });
}
