export const MEAL_TYPES = Object.freeze(["breakfast", "lunch", "dinner", "snack"]);

const pad = (value) => String(value).padStart(2, "0");
const isoOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function rollingMealDates(currentDate = new Date(), weeks = 4) {
  const monday = new Date(currentDate);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  return Array.from({ length: Math.max(1, weeks) * 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    return isoOf(date);
  });
}

export function fillRollingMealPlan({
  plan = {},
  recipes = [],
  currentDate = new Date(),
  weeks = 4,
  meals = MEAL_TYPES
} = {}) {
  const dates = rollingMealDates(currentDate, weeks);
  const validRecipes = recipes.filter((recipe) => recipe && recipe.id);
  const validIds = new Set(validRecipes.map((recipe) => recipe.id));
  const nextPlan = { ...plan };
  let filled = 0;

  dates.forEach((date, dayIndex) => {
    const dayPlan = plan[date] && typeof plan[date] === "object" ? { ...plan[date] } : {};
    meals.forEach((meal, mealIndex) => {
      if (validIds.has(dayPlan[meal])) return;
      const categoryRecipes = validRecipes.filter((recipe) => recipe.cat === meal);
      const candidates = categoryRecipes.length ? categoryRecipes : validRecipes;
      if (!candidates.length) return;
      const rotationIndex = dayIndex + mealIndex * 2 + Math.floor(dayIndex / 7);
      dayPlan[meal] = candidates[rotationIndex % candidates.length].id;
      filled += 1;
    });
    nextPlan[date] = dayPlan;
  });

  return { plan: nextPlan, dates, filled };
}

