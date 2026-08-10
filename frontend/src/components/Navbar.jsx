import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();
  const isHome = location.pathname === "/";

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
    </header>
  );
}
