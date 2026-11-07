import { isPlannerRecipeAllowed } from "./meal-plan.mjs";

// Use explicit recipe metadata, never calories or a sugar-free claim on its own.
export function isDiabeticFriendlyRecipe(recipe) {
  return Array.isArray(recipe?.tags) && recipe.tags.some((tag) =>
    ["steady-blood-sugar", "diabetic-friendly", "diabetes-friendly"].includes(String(tag).trim().toLowerCase())
  );
}

export function diabeticAlternativeFor({ date, meal, currentItem, recipes = [], plan = {} }) {
  if (!currentItem || isDiabeticFriendlyRecipe(currentItem)) return null;
  const neighbors = [-1, 1].map((offset) => {
    const day = new Date(`${date}T12:00:00`);
    day.setDate(day.getDate() + offset);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  });
  const blocked = new Set([
    currentItem.id,
    ...Object.values(plan[date] || {}),
    ...neighbors.flatMap((day) => Object.values(plan[day] || {}))
  ]);
  const candidates = recipes.filter((item) => item?.id && item.cat === meal &&
    isPlannerRecipeAllowed(item) && isDiabeticFriendlyRecipe(item) && !blocked.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!candidates.length) return null;
  const hash = `${date}|${meal}|diabetes`.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
  return candidates[hash % candidates.length];
}
