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

export async function getCategories() {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Kategorien konnten nicht geladen werden");
  return res.json();
}

/**
 * Found-item pins for the map. Pass `lat`/`lng` (the browsing user's own
 * position) to get each item annotated with `distance_m` and sorted
 * nearest-first - powers both the map and the "X Gegenstände in deiner
 * Nähe" count. `radiusM` additionally filters server-side.
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

/**
 * Reports a found item. Uses XMLHttpRequest (not fetch) specifically to get
 * real upload-progress events for the photo, reported via `onProgress`
 * (0-100) so the UI can show a percentage bar instead of a plain spinner.
 */
export function createFoundItem({ category, description, lat, lng, photo, onProgress }) {
  const form = new FormData();
  form.append("category", category);
  if (description) form.append("description", description);
  form.append("lat", lat);
  form.append("lng", lng);
  if (photo) form.append("photo", photo);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/found-items");

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
        reject(new Error(detailToMessage(body.detail, "Fund konnte nicht gespeichert werden")));
      }
    };

    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Hochladen. Bitte erneut versuchen."));
    xhr.send(form);
  });
}

export async function deleteFoundItem(id) {
  const res = await fetch(`/api/found-items/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Fund konnte nicht gelöscht werden"));
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
