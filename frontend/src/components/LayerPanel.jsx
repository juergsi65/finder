import { useTranslation } from "../i18n/LanguageContext.jsx";

const TYPE_OPTIONS = [
  { key: "found", icon: "📍", tone: "text-trail-700" },
  { key: "lost", icon: "🎒", tone: "text-red-500" },
  { key: "stolen", icon: "🚨", tone: "text-red-700" },
  { key: "pins", icon: "📌", tone: "text-violet-700" },
];

/**
 * Layer/filter panel for the home map: toggle whole types (found/lost/
 * stolen/notes) and, separately, individual categories - independent
 * axes, so "only stolen bikes" is just as easy as "everything except
 * notes". Both are "hidden set" models (nothing hidden by default) rather
 * than "visible set" so newly-loaded categories show up automatically
 * without Home needing to pre-populate anything.
 */
export default function LayerPanel({
  counts,
  hiddenTypes,
  onToggleType,
  categories,
  hiddenCategories,
  onToggleCategory,
  onResetCategories,
  onClose,
}) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-[1300] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-float w-full sm:max-w-sm max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-5 pb-3 shrink-0">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
            <span aria-hidden>🗂️</span> {t("layers.heading")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("layers.types")}</h3>
            <div className="space-y-1.5">
              {TYPE_OPTIONS.map((opt) => {
                const checked = !hiddenTypes.has(opt.key);
                return (
                  <label
                    key={opt.key}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span className={`text-lg ${opt.tone}`} aria-hidden>
                        {opt.icon}
                      </span>
                      {t(`layers.type.${opt.key}`)}
                      <span className="text-xs text-slate-400">({counts[opt.key] ?? 0})</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleType(opt.key)}
                      className="w-4 h-4 rounded border-slate-300 text-trail-600 focus:ring-trail-500"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {categories.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("layers.categories")}</h3>
                {hiddenCategories.size > 0 && (
                  <button type="button" onClick={onResetCategories} className="text-xs text-trail-700 font-medium">
                    {t("layers.showAll")}
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {categories.map(({ name, icon, count }) => {
                  const checked = !hiddenCategories.has(name);
                  return (
                    <label
                      key={name}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-700 min-w-0">
                        <span className="text-lg shrink-0" aria-hidden>
                          {icon}
                        </span>
                        <span className="truncate">{name}</span>
                        <span className="text-xs text-slate-400 shrink-0">({count})</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleCategory(name)}
                        className="w-4 h-4 rounded border-slate-300 text-trail-600 focus:ring-trail-500 shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
