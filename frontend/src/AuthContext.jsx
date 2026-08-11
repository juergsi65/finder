import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiLogin, apiRegister, apiGetMe, apiUpdateProfile, getUnreadCount, setAuthToken } from "./api.js";

const STORAGE_KEY = "trailfound_token";
// How often to poll for new unread messages while the app is open - a
// balance between "badge feels live" and not hammering the API. Opening a
// conversation also triggers an immediate refresh (see Conversation.jsx),
// so this interval only matters for messages that arrive while the user
// is elsewhere in the app.
const UNREAD_POLL_MS = 30_000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setAuthToken(token);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiGetMe()
      .then(setUser)
      .catch(() => {
        // Token expired/invalid - drop it silently and fall back to logged-out.
        localStorage.removeItem(STORAGE_KEY);
        setAuthToken(null);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (email, password) => {
    const { access_token } = await apiLogin(email, password);
    localStorage.setItem(STORAGE_KEY, access_token);
    setToken(access_token);
  }, []);

  const register = useCallback(
    async ({ email, password, role, displayName, alertOptIn }) => {
      await apiRegister({ email, password, role, displayName, alertOptIn });
      await login(email, password);
    },
    [login]
  );

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    const fresh = await apiGetMe();
    setUser(fresh);
    return fresh;
  }, [token]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (fields) => {
    const updated = await apiUpdateProfile(fields);
    setUser(updated);
    return updated;
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const { unread_count } = await getUnreadCount();
      setUnreadCount(unread_count);
    } catch {
      // Transient failure - the next poll (or the next manual trigger,
      // e.g. opening a conversation) will pick it back up. Never let a
      // failed badge refresh surface as an app-wide error.
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      return;
    }
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, UNREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [token, refreshUnreadCount]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateProfile, refreshUser, unreadCount, refreshUnreadCount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
  return ctx;
}
