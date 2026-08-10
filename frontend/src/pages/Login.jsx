import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import Spinner from "../components/Spinner.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(email, password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 bg-gradient-to-b from-trail-50 to-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2" aria-hidden>
            🔐
          </div>
          <h1 className="text-xl font-bold text-gray-800">Anmelden</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-white p-5 rounded-2xl shadow border border-gray-100"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-trail-600 disabled:bg-gray-300 hover:bg-trail-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {submitting && <Spinner />}
            {submitting ? "Anmelden..." : "Anmelden"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Noch kein Konto?{" "}
          <Link to="/registrieren" className="text-trail-700 font-semibold">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
