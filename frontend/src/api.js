// Thin wrapper around the TrailFound backend API.
// In dev, Vite proxies /api -> http://localhost:8000 (see vite.config.js).

export async function getCategories() {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Kategorien konnten nicht geladen werden");
  return res.json();
}

export async function getFoundItems(category) {
  const url = category ? `/api/found-items?category=${encodeURIComponent(category)}` : "/api/found-items";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fund-Pins konnten nicht geladen werden");
  return res.json();
}

export async function createFoundItem({ category, description, lat, lng, photo }) {
  const form = new FormData();
  form.append("category", category);
  if (description) form.append("description", description);
  form.append("lat", lat);
  form.append("lng", lng);
  if (photo) form.append("photo", photo);

  const res = await fetch("/api/found-items", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Fund konnte nicht gespeichert werden");
  }
  return res.json();
}

export async function matchGpx({ category, gpxFile, radiusM = 30 }) {
  const form = new FormData();
  form.append("category", category);
  form.append("radius_m", radiusM);
  form.append("gpx_file", gpxFile);

  const res = await fetch("/api/match", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Abgleich fehlgeschlagen");
  }
  return res.json();
}
