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
