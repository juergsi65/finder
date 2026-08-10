import { categoryIcon } from "../categoryIcons.js";

/**
 * Icon-chip category selector, used in both Finder- and Seeker-Mode.
 * Behaves like a single-select (radio-group semantics) but is far easier
 * to hit with a thumb than a native <select> on mobile.
 */
export default function CategoryPicker({ categories, value, onChange, label }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
        {categories.map((c) => {
          const active = c === value;
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
                  : "border-gray-200 bg-white text-gray-600 active:scale-95 hover:border-trail-300"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {categoryIcon(c)}
              </span>
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}
