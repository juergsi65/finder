// Shared icon mapping so Finder- and Seeker-Mode present categories consistently.
export const CATEGORY_ICONS = {
  Trinkflasche: "🧴",
  Radcomputer: "📟",
  Pumpe: "🛠️",
  Brille: "🕶️",
  Sonstiges: "📦",
};

export function categoryIcon(category) {
  return CATEGORY_ICONS[category] || "📦";
}

/**
 * Translated label for a category chip. Only the fixed default categories
 * have `categories.*` i18n entries - a custom category minted via
 * CategoryCreator has no translation key, so `t()` would otherwise fall
 * back to returning the raw "categories.Skateboard" lookup key verbatim.
 * Custom categories are already just plain user-entered text, so falling
 * back to the name itself (untranslated, same in both languages) is
 * correct rather than a bug to route around.
 */
export function categoryLabel(t, category) {
  return category in CATEGORY_ICONS ? t(`categories.${category}`) : category;
}

/** An item's own chosen icon (custom categories can have any emoji) wins;
 * only falls back to the name-based default for items that predate the
 * per-item icon field, or where the category happens to be a known one
 * without a custom icon picked. */
export function resolveIcon(item) {
  return item?.icon || categoryIcon(item?.category);
}

// Curated quick-pick grid offered when a user creates a custom category -
// covers the most common "lost gear" cases without forcing everyone
// through their OS emoji keyboard, which stays available via the free-text
// input right next to it for anything not in this list.
export const EMOJI_QUICK_PICKS = [
  "🚲", "🛴", "🛹", "🏍️", "🚗", "🔑", "🔐", "🎒", "👜", "🧳",
  "👛", "💳", "🪪", "📱", "💻", "📷", "🎧", "⌚", "📟", "🔋",
  "☂️", "🧢", "🕶️", "👓", "🧤", "🧦", "🥾", "👟", "⛷️", "🏂",
  "🥏", "⚽", "🏀", "🎾", "🏕️", "🧭", "🔦", "🐕", "🐈", "📦",
];
