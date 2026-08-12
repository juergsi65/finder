import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n/LanguageContext.jsx";

/**
 * Opened by clicking empty map area on Home - the single entry point for
 * "I want to do something at this exact spot", replacing the old
 * behavior of jumping straight into note-pin creation. Found/lost/stolen
 * options navigate to their full form with the clicked position carried
 * along as router state (see FinderMode/LostStolenMode's `prefillLatLng`)
 * so the user still confirms/adjusts the exact pin on that page's own
 * picker; "Notiz setzen" stays lightweight and opens PinModal in place
 * via `onNote` instead of leaving the map.
 */
export default function MapActionMenu({ latlng, onClose, onNote }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  function go(path, extraState) {
    navigate(path, { state: { prefillLatLng: latlng, ...extraState } });
    onClose();
  }

  const options = [
    { icon: "📍", label: t("mapMenu.reportFound"), onClick: () => go("/gefunden"), tone: "trail" },
    { icon: "🎒", label: t("mapMenu.reportLost"), onClick: () => go("/verlust", { reportType: "lost" }), tone: "red" },
    { icon: "🚨", label: t("mapMenu.reportStolen"), onClick: () => go("/verlust", { reportType: "stolen" }), tone: "red" },
    {
      icon: "📌",
      label: t("mapMenu.addNote"),
      onClick: () => {
        onNote(latlng);
        onClose();
      },
      tone: "violet",
    },
  ];

  const toneClasses = {
    trail: "border-trail-200 hover:bg-trail-50 text-trail-700",
    red: "border-red-200 hover:bg-red-50 text-red-600",
    violet: "border-violet-200 hover:bg-violet-50 text-violet-700",
  };

  return (
    <div
      className="fixed inset-0 z-[1300] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-float w-full sm:max-w-sm p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">{t("mapMenu.heading")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={opt.onClick}
              className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 font-semibold text-sm bg-white transition active:scale-[0.98] ${toneClasses[opt.tone]}`}
            >
              <span className="text-xl" aria-hidden>
                {opt.icon}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
