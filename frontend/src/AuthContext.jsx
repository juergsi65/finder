import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiLogin, apiRegister, apiGetMe, apiUpdateProfile, setAuthToken } from "./api.js";

const STORAGE_KEY = "trailfound_token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
    async (email, password) => {
      await apiRegister(email, password);
      await login(email, password);
    },
    [login]
  );

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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
  return ctx;
}
