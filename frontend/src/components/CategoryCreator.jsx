import { useState } from "react";
import { categoryIcon, categoryLabel, EMOJI_QUICK_PICKS } from "../categoryIcons.js";
import { useTranslation } from "../i18n/LanguageContext.jsx";

/**
 * Category + emoji picker for the found/lost/stolen creation forms - like
 * CategoryPicker (same quick-select chip grid for the known defaults) but
 * with an extra "Eigene Kategorie" chip that reveals a name field + emoji
 * picker, so a user isn't limited to the built-in list. Read-only filter
 * UIs (Search, Home's layer panel) keep using the plain CategoryPicker -
 * only the actual creation forms need to *mint* a new category.
 */
export default function CategoryCreator({ categories, category, icon, onChange, label }) {
  const { t } = useTranslation();
  const isKnown = categories.includes(category);
  const [customMode, setCustomMode] = useState(!isKnown && !!category);
  const [customName, setCustomName] = useState(!isKnown ? category || "" : "");
  const [customIcon, setCustomIcon] = useState(!isKnown ? icon || "" : "");

  function selectKnown(c) {
    setCustomMode(false);
    onChange({ category: c, icon: null });
  }

  function activateCustom() {
    setCustomMode(true);
    onChange({ category: customName, icon: customIcon || null });
  }

  function updateCustomName(name) {
    setCustomName(name);
    onChange({ category: name, icon: customIcon || null });
  }

  function updateCustomIcon(value) {
    setCustomIcon(value);
    onChange({ category: customName, icon: value || null });
  }

  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
        {categories.map((c) => {
          const active = !customMode && c === category;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => selectKnown(c)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-3 px-1 text-[11px] font-medium leading-tight text-center transition ${
                active
                  ? "border-trail-600 bg-trail-50 text-trail-700 ring-2 ring-trail-500"
                  : "border-slate-200 bg-white text-slate-600 active:scale-95 hover:border-trail-300"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {categoryIcon(c)}
              </span>
              {categoryLabel(t, c)}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={customMode}
          onClick={activateCustom}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-3 px-1 text-[11px] font-medium leading-tight text-center transition ${
            customMode
              ? "border-trail-600 bg-trail-50 text-trail-700 ring-2 ring-trail-500"
              : "border-dashed border-slate-300 bg-white text-slate-500 active:scale-95 hover:border-trail-300"
          }`}
        >
          <span className="text-2xl" aria-hidden>
            {customIcon || "✏️"}
          </span>
          {t("category.custom")}
        </button>
      </div>

      {customMode && (
        <div className="mt-3 space-y-2.5 rounded-xl border border-trail-100 bg-trail-50/40 p-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("category.customName")}</label>
            <input
              type="text"
              maxLength={60}
              value={customName}
              onChange={(e) => updateCustomName(e.target.value)}
              placeholder={t("category.customNamePlaceholder")}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("category.customIcon")}</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {EMOJI_QUICK_PICKS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => updateCustomIcon(emoji)}
                  aria-label={emoji}
                  className={`w-9 h-9 flex items-center justify-center text-lg rounded-lg border transition ${
                    customIcon === emoji
                      ? "border-trail-600 bg-trail-100 ring-2 ring-trail-500"
                      : "border-slate-200 bg-white hover:border-trail-300 active:scale-90"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input
              type="text"
              maxLength={8}
              value={customIcon}
              onChange={(e) => updateCustomIcon(e.target.value)}
              placeholder={t("category.customIconPlaceholder")}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
}
