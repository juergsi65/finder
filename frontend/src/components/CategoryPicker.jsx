import { categoryIcon, categoryLabel } from "../categoryIcons.js";
import { useTranslation } from "../i18n/LanguageContext.jsx";

/**
 * Icon-chip category selector, used across Finder-Mode, Search and Home.
 * Behaves like a single-select (radio-group semantics) but is far easier
 * to hit with a thumb than a native <select> on mobile. Category labels are
 * translated (DE/EN); pass `allValue` to render one of the entries as a
 * generic "all categories" chip instead of looking up a category icon/label.
 */
export default function CategoryPicker({ categories, value, onChange, label, allValue }) {
  const { t } = useTranslation();

  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
        {categories.map((c) => {
          const active = c === value;
          const isAll = allValue != null && c === allValue;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(c)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-3 px-1 text-[11px] font-medium leading-tight text-center transition ${
                active
                  ? "border-trail-600 bg-trail-50 text-trail-700 ring-2 ring-trail-500"
                  : "border-slate-200 bg-white text-slate-600 active:scale-95 hover:border-trail-300"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {isAll ? "🗺️" : categoryIcon(c)}
              </span>
              {isAll ? t("home.all") : categoryLabel(t, c)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
