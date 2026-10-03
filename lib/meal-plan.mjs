export const MEAL_TYPES = Object.freeze(["breakfast", "lunch", "dinner", "snack"]);

export function isPlannerRecipeAllowed(recipe) {
  return Boolean(recipe) && ![recipe.name, ...(recipe.aliases || [])]
    .some((name) => /\bpancakes?\b/i.test(String(name || "")));
}

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
  meals = MEAL_TYPES,
  ensureCoverage = true
} = {}) {
  const dates = rollingMealDates(currentDate, weeks);
  const validRecipes = recipes.filter((recipe) => recipe && recipe.id && isPlannerRecipeAllowed(recipe));
  const validIds = new Set(validRecipes.map((recipe) => recipe.id));
  const excludedIds = new Set(recipes.filter((recipe) => recipe?.id && !isPlannerRecipeAllowed(recipe)).map((recipe) => recipe.id));
  const nextPlan = { ...plan };
  let filled = 0;
  let repeatsResolved = 0;

  const candidatesForMeal = (meal) => {
    const categoryRecipes = validRecipes.filter((recipe) => recipe.cat === meal);
    return categoryRecipes.length ? categoryRecipes : validRecipes;
  };

  const chooseCandidate = (meal, dayIndex, mealIndex, blocked = new Set()) => {
    const candidates = candidatesForMeal(meal);
    if (!candidates.length) return null;
    const start = dayIndex + mealIndex * 2 + Math.floor(dayIndex / 7);
    for (let offset = 0; offset < candidates.length; offset += 1) {
      const candidate = candidates[(start + offset) % candidates.length];
      if (!blocked.has(candidate.id)) return candidate;
    }
    return candidates[start % candidates.length];
  };

  // Repair saved pancake meals, including dates outside the rolling window.
  Object.keys(nextPlan).sort().forEach((date, dayIndex) => {
    const savedDay = nextPlan[date];
    if (!savedDay || typeof savedDay !== "object") return;
    const dayPlan = { ...savedDay };
    let changed = false;
    meals.forEach((meal, mealIndex) => {
      if (!excludedIds.has(dayPlan[meal])) return;
      const candidate = chooseCandidate(meal, dayIndex, mealIndex, new Set(Object.values(dayPlan)));
      if (candidate) dayPlan[meal] = candidate.id;
      else delete dayPlan[meal];
      filled += 1;
      changed = true;
    });
    if (changed) nextPlan[date] = dayPlan;
  });

  dates.forEach((date, dayIndex) => {
    const dayPlan = nextPlan[date] && typeof nextPlan[date] === "object" ? { ...nextPlan[date] } : {};
    meals.forEach((meal, mealIndex) => {
      if (validIds.has(dayPlan[meal])) return;
      const previousIds = dayIndex > 0 ? new Set(Object.values(nextPlan[dates[dayIndex - 1]] || {})) : new Set();
      const currentIds = new Set(Object.values(dayPlan).filter(Boolean));
      const candidate = chooseCandidate(meal, dayIndex, mealIndex, new Set([...previousIds, ...currentIds]));
      if (!candidate) return;
      dayPlan[meal] = candidate.id;
      filled += 1;
    });
    nextPlan[date] = dayPlan;
  });

  const countUsage = () => {
    const usage = new Map(validRecipes.map((recipe) => [recipe.id, 0]));
    dates.forEach((date) => meals.forEach((meal) => {
      const recipeId = nextPlan[date]?.[meal];
      if (usage.has(recipeId)) usage.set(recipeId, usage.get(recipeId) + 1);
    }));
    return usage;
  };

  const repairConsecutiveRepeats = () => {
    const usage = countUsage();
    dates.forEach((date, dayIndex) => {
      const previousIds = dayIndex > 0 ? new Set(Object.values(nextPlan[dates[dayIndex - 1]] || {})) : new Set();
      const currentIds = new Set();
      meals.forEach((meal, mealIndex) => {
        const currentId = nextPlan[date]?.[meal];
        if (!validIds.has(currentId)) return;
        if (!previousIds.has(currentId) && !currentIds.has(currentId)) {
          currentIds.add(currentId);
          return;
        }
        const candidate = chooseCandidate(meal, dayIndex, mealIndex, new Set([...previousIds, ...currentIds]));
        if (!candidate || candidate.id === currentId) {
          currentIds.add(currentId);
          return;
        }
        usage.set(currentId, Math.max(0, (usage.get(currentId) || 0) - 1));
        nextPlan[date][meal] = candidate.id;
        usage.set(candidate.id, (usage.get(candidate.id) || 0) + 1);
        currentIds.add(candidate.id);
        repeatsResolved += 1;
      });
    });
  };

  repairConsecutiveRepeats();
  const usage = countUsage();

  let coverageAdded = 0;
  if (ensureCoverage) validRecipes.forEach((recipe) => {
    if ((usage.get(recipe.id) || 0) > 0) return;
    const compatibleMeals = meals.includes(recipe.cat) ? [recipe.cat] : meals;
    const target = [...dates].reverse().flatMap((date) => compatibleMeals.map((meal) => ({ date, meal })))
      .find(({ date, meal }) => {
        const currentId = nextPlan[date]?.[meal];
        if (!validIds.has(currentId) || (usage.get(currentId) || 0) <= 1) return false;
        const dateIndex = dates.indexOf(date);
        const neighboringIds = new Set([
          ...Object.values(nextPlan[dates[dateIndex - 1]] || {}),
          ...Object.values(nextPlan[dates[dateIndex + 1]] || {}),
          ...Object.values(nextPlan[date] || {})
        ]);
        neighboringIds.delete(currentId);
        return !neighboringIds.has(recipe.id);
      });
    if (!target) return;
    const currentId = nextPlan[target.date][target.meal];
    usage.set(currentId, usage.get(currentId) - 1);
    nextPlan[target.date][target.meal] = recipe.id;
    usage.set(recipe.id, 1);
    coverageAdded += 1;
    filled += 1;
  });

  repairConsecutiveRepeats();
  return { plan: nextPlan, dates, filled, coverageAdded, repeatsResolved };
}
