import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 gap-6 bg-gradient-to-b from-trail-50 to-white">
      <div className="text-center mb-4">
        <div className="text-5xl mb-2" aria-hidden>
          🧭
        </div>
        <h1 className="text-2xl font-bold text-gray-800">TrailFound</h1>
        <p className="text-gray-500 mt-1 max-w-xs mx-auto">
          Verlorene Sport-Ausrüstung wiederfinden - über GPS-Tracks und Fund-Pins.
        </p>
      </div>

      <Link
        to="/gefunden"
        className="w-full max-w-sm bg-trail-600 hover:bg-trail-700 active:scale-[0.98] transition text-white font-semibold py-5 rounded-2xl shadow-lg flex items-center justify-center gap-3 text-lg"
      >
        <span className="text-2xl" aria-hidden>
          📍
        </span>
        Etwas gefunden
      </Link>

      <Link
        to="/verloren"
        className="w-full max-w-sm bg-white hover:bg-gray-50 active:scale-[0.98] transition text-trail-700 border-2 border-trail-600 font-semibold py-5 rounded-2xl shadow flex items-center justify-center gap-3 text-lg"
      >
        <span className="text-2xl" aria-hidden>
          🔍
        </span>
        Etwas verloren
      </Link>

      <p className="text-xs text-gray-400 mt-6 text-center max-w-xs">
        Prototyp - Fund-Pins landen in einer lokalen Datenbank, der GPX-Abgleich läuft im
        30-Meter-Radius um deine Route.
      </p>
    </div>
  );
}
