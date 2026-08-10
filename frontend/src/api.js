// Thin wrapper around the TrailFound backend API.
// In dev, Vite proxies /api -> http://localhost:8000 (see vite.config.js).

let authToken = null;

/** Called by AuthContext whenever the token changes (login/logout/refresh). */
export function setAuthToken(token) {
  authToken = token;
}

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

// FastAPI returns `detail` as a plain string for our own HTTPExceptions, but
// as an array of {msg, loc, ...} for pydantic validation errors (422) - this
// normalizes both into a single readable message.
async function extractErrorMessage(res, fallback) {
  const body = await res.json().catch(() => ({}));
  const detail = body.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
  }
  return fallback;
}

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
    throw new Error(await extractErrorMessage(res, "Fund konnte nicht gespeichert werden"));
  }
  return res.json();
}

export async function deleteFoundItem(id) {
  const res = await fetch(`/api/found-items/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Fund konnte nicht gelöscht werden"));
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
    throw new Error(await extractErrorMessage(res, "Abgleich fehlgeschlagen"));
  }
  return res.json();
}

// --- Auth --------------------------------------------------------------

export async function apiRegister(email, password) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Registrierung fehlgeschlagen"));
  }
  return res.json();
}

export async function apiLogin(email, password) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Login fehlgeschlagen"));
  }
  return res.json();
}

export async function apiGetMe() {
  const res = await fetch("/api/auth/me", { headers: authHeaders() });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Nicht angemeldet"));
  return res.json();
}

export async function apiUpdateProfile(fields) {
  const res = await fetch("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Profil konnte nicht aktualisiert werden"));
  }
  return res.json();
}

// --- Admin ---------------------------------------------------------------

export async function apiAdminListUsers() {
  const res = await fetch("/api/admin/users", { headers: authHeaders() });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Nutzerliste konnte nicht geladen werden"));
  return res.json();
}

export async function apiAdminDeleteUser(id) {
  const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Nutzer konnte nicht gelöscht werden"));
  }
  return res.json();
}

export async function apiAdminStats() {
  const res = await fetch("/api/admin/stats", { headers: authHeaders() });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Statistiken konnten nicht geladen werden"));
  return res.json();
}
