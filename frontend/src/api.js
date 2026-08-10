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
function detailToMessage(detail, fallback) {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
  }
  return fallback;
}

async function extractErrorMessage(res, fallback) {
  const body = await res.json().catch(() => ({}));
  return detailToMessage(body.detail, fallback);
}

/** XMLHttpRequest-based multipart POST/PATCH with real upload-progress. */
function xhrMultipart(method, url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(authHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON response - fall through to status-based handling below
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(body);
      } else {
        reject(new Error(detailToMessage(body.detail, "Anfrage fehlgeschlagen")));
      }
    };

    xhr.onerror = () => reject(new Error("Netzwerkfehler. Bitte erneut versuchen."));
    xhr.send(form);
  });
}

export async function getCategories() {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Kategorien konnten nicht geladen werden");
  return res.json();
}

/**
 * Active found-item pins for the map/search. Pass `lat`/`lng` (the browsing
 * user's own position) to get each item annotated with `distance_m` and
 * sorted nearest-first - powers both the map and the "X in deiner Nähe"
 * count. `radiusM` additionally filters server-side. Archived items are
 * never included.
 */
export async function getFoundItems({ category, lat, lng, radiusM } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (lat != null && lng != null) {
    params.set("lat", lat);
    params.set("lng", lng);
  }
  if (radiusM != null) params.set("radius_m", radiusM);

  const qs = params.toString();
  const res = await fetch(qs ? `/api/found-items?${qs}` : "/api/found-items");
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Fund-Pins konnten nicht geladen werden"));
  return res.json();
}

export async function getFoundItem(id) {
  const res = await fetch(`/api/found-items/${id}`);
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Fund-Pin konnte nicht geladen werden"));
  return res.json();
}

/**
 * Reports a found item (auth required). Uses XMLHttpRequest for real
 * upload-progress events on the (mandatory) photo, reported via
 * `onProgress` (0-100) so the UI can show a percentage bar.
 */
export function createFoundItem({ title, category, description, lat, lng, foundDate, photo, onProgress }) {
  const form = new FormData();
  form.append("title", title);
  form.append("category", category);
  if (description) form.append("description", description);
  form.append("lat", lat);
  form.append("lng", lng);
  if (foundDate) form.append("found_date", foundDate);
  form.append("photo", photo);

  return xhrMultipart("POST", "/api/found-items", form, onProgress);
}

export async function setFoundItemStatus(id, status) {
  const form = new FormData();
  form.append("status", status);
  const res = await fetch(`/api/found-items/${id}`, { method: "PATCH", headers: authHeaders(), body: form });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Status konnte nicht geändert werden"));
  return res.json();
}

export async function deleteFoundItem(id) {
  const res = await fetch(`/api/found-items/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Fund konnte nicht gelöscht werden"));
  }
  return res.json();
}

/**
 * GPX-based search: query/category + a GPX track -> only found items within
 * radius of the route. Real upload-progress via XHR (onProgress 0-100).
 */
export function searchGpx({ query, category, gpxFile, radiusM = 30, onProgress }) {
  const form = new FormData();
  if (query) form.append("query", query);
  if (category) form.append("category", category);
  form.append("radius_m", radiusM);
  form.append("gpx_file", gpxFile);

  return xhrMultipart("POST", "/api/search/gpx", form, onProgress);
}

// --- Strava --------------------------------------------------------------

export async function getStravaStatus() {
  const res = await fetch("/api/strava/status", { headers: authHeaders() });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Strava-Status konnte nicht geladen werden"));
  return res.json();
}

export async function getStravaConnectUrl() {
  const res = await fetch("/api/strava/connect", { headers: authHeaders() });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Strava-Verbindung fehlgeschlagen"));
  return res.json();
}

export async function disconnectStrava() {
  const res = await fetch("/api/strava/disconnect", { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Strava konnte nicht getrennt werden"));
  return res.json();
}

export async function getStravaTodayTrack({ query, category, radiusM = 30 } = {}) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (category) params.set("category", category);
  params.set("radius_m", radiusM);
  const res = await fetch(`/api/strava/today-track?${params.toString()}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Strava-Abgleich fehlgeschlagen"));
  return res.json();
}

// --- Messaging -------------------------------------------------------------

export async function contactFinder(itemId, body) {
  const res = await fetch(`/api/found-items/${itemId}/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Nachricht konnte nicht gesendet werden"));
  return res.json();
}

export async function getConversations() {
  const res = await fetch("/api/conversations", { headers: authHeaders() });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Nachrichten konnten nicht geladen werden"));
  return res.json();
}

export async function getConversation(id) {
  const res = await fetch(`/api/conversations/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Unterhaltung konnte nicht geladen werden"));
  return res.json();
}

export async function sendMessage(conversationId, body) {
  const res = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Nachricht konnte nicht gesendet werden"));
  return res.json();
}

// --- Auth --------------------------------------------------------------

export async function apiRegister({ email, password, role, displayName }) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role, display_name: displayName || null }),
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

export async function apiAdminListFoundItems(statusFilter) {
  const qs = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : "";
  const res = await fetch(`/api/admin/found-items${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Fund-Pins konnten nicht geladen werden"));
  return res.json();
}

export async function apiAdminStats() {
  const res = await fetch("/api/admin/stats", { headers: authHeaders() });
  if (!res.ok) throw new Error(await extractErrorMessage(res, "Statistiken konnten nicht geladen werden"));
  return res.json();
}
