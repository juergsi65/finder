import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const isHome = location.pathname === "/";

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="bg-trail-600 text-white px-4 py-3 flex items-center gap-2 shadow-sm shrink-0">
      {!isHome && (
        <Link to="/" className="text-white/90 hover:text-white text-xl leading-none px-1" aria-label="Zurück">
          ←
        </Link>
      )}
      <Link to="/" className="font-bold text-lg tracking-tight flex items-center gap-1.5">
        <span aria-hidden>🧭</span> TrailFound
      </Link>

      <div className="ml-auto flex items-center gap-1.5 text-sm shrink-0">
        {loading ? null : user ? (
          <>
            {user.role === "admin" && (
              <Link
                to="/admin"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-base"
                aria-label="Admin"
                title="Admin"
              >
                👑
              </Link>
            )}
            <Link
              to="/profil"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-base"
              aria-label={`Profil (${user.email})`}
              title={user.email}
            >
              👤
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-base"
              aria-label="Abmelden"
              title="Abmelden"
            >
              ⏻
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-white/90 hover:text-white font-medium px-1">
              Anmelden
            </Link>
            <Link
              to="/registrieren"
              className="bg-white text-trail-700 font-semibold rounded-full px-3 py-1 hover:bg-trail-50 whitespace-nowrap"
            >
              Registrieren
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
