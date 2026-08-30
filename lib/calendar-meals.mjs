export const GOOGLE_CALENDAR_SOURCE = "pjomill@gmail.com";

export const CALENDAR_MEAL_DEFINITIONS = Object.freeze([
  {
    name: "Breakfast (V-Taper Foundation)", cat: "breakfast", cal: 490, time: 15, imageKey: "eggs",
    tags: ["Google Calendar", "V-Taper", "high-protein"],
    calendarNote: "1.5 cups Egg Whites + 2 Whole Eggs. 1/2 cup Oats (dry) with cinnamon.",
    ingredients: [[1.5, "cup", "egg whites"], [2, "pc", "whole egg"], [0.5, "cup", "rolled oats"], [0.25, "tsp", "cinnamon"]],
    steps: ["Cook the oats with water until tender and season with cinnamon.", "Scramble the egg whites and whole eggs in a nonstick pan until fully set.", "Serve the eggs with the warm oats."]
  },
  {
    name: "Lunch (V-Taper Foundation)", cat: "lunch", cal: 490, time: 30, imageKey: "wrap",
    tags: ["Google Calendar", "V-Taper", "high-protein"],
    calendarNote: "200g Grilled Chicken Breast + 1 medium Sweet Potato + Steamed Green Beans.",
    ingredients: [[200, "g", "chicken breast"], [1, "pc", "sweet potato"], [1, "cup", "green beans"], [1, "tsp", "olive oil"]],
    steps: ["Grill the chicken until its thickest part reaches 74°C.", "Bake or steam the sweet potato until tender.", "Steam the green beans and serve everything together."]
  },
  {
    name: "Pre-Workout Snack (V-Taper Foundation)", cat: "snack", cal: 125, time: 5, imageKey: "yogurt",
    tags: ["Google Calendar", "V-Taper", "pre-workout"],
    calendarNote: "1 scoop Protein Powder + 1 Black Coffee.",
    ingredients: [[1, "scoop", "protein powder"], [1, "cup", "black coffee"], [1, "cup", "water"]],
    steps: ["Shake the protein powder with water until smooth.", "Serve with unsweetened black coffee."]
  },
  {
    name: "Dinner (V-Taper Foundation)", cat: "dinner", cal: 390, time: 25, imageKey: "salad",
    tags: ["Google Calendar", "V-Taper", "high-protein"],
    calendarNote: "200g White Fish + Large Salad (Spinach, Cucumber) + 1/2 Avocado.",
    ingredients: [[200, "g", "white fish"], [2, "cup", "spinach"], [1, "cup", "cucumber"], [0.5, "pc", "avocado"], [1, "tsp", "olive oil"]],
    steps: ["Bake or pan-sear the fish until opaque and cooked through.", "Toss the spinach and cucumber with olive oil.", "Top the salad with avocado and serve with the fish."]
  },
  {
    name: "Evening Snack (Sleep-Support)", cat: "snack", cal: 160, time: 5, imageKey: "yogurt",
    tags: ["Google Calendar", "sleep-support", "quick"],
    calendarNote: "150g Non-fat Greek Yogurt + 10g Walnuts + Cinnamon.",
    ingredients: [[150, "g", "non-fat Greek yogurt"], [10, "g", "walnuts"], [0.25, "tsp", "cinnamon"]],
    steps: ["Spoon the yogurt into a bowl.", "Top with walnuts and cinnamon."]
  },
  {
    name: "Breakfast (Recovery & Refine)", cat: "breakfast", cal: 330, time: 15, imageKey: "eggs",
    tags: ["Google Calendar", "recovery", "high-protein"],
    calendarNote: "1.5 cups Egg Whites + 1 Whole Egg (Scrambled with mushrooms and kale) and 100g Berries (Blueberries/Raspberries).",
    ingredients: [[1.5, "cup", "egg whites"], [1, "pc", "whole egg"], [0.5, "cup", "mushrooms"], [1, "cup", "kale"], [100, "g", "mixed berries"]],
    steps: ["Sauté the mushrooms and kale in a nonstick pan.", "Add the egg whites and whole egg, then scramble until fully set.", "Serve with the berries."]
  },
  {
    name: "Lunch (Recovery & Refine)", cat: "lunch", cal: 430, time: 30, imageKey: "salad",
    tags: ["Google Calendar", "recovery", "high-protein"],
    calendarNote: "200g Grilled Chicken Breast or 200g Firm Tofu. Large Salad: Arugula, Cucumber, Celery, and Radish. 150g Steamed Asparagus.",
    ingredients: [[200, "g", "chicken breast"], [2, "cup", "arugula"], [1, "cup", "cucumber"], [1, "pc", "celery stalk"], [0.5, "cup", "radish"], [150, "g", "asparagus"]],
    steps: ["Grill the chicken until it reaches 74°C; firm tofu may be used instead.", "Steam the asparagus until crisp-tender.", "Toss the arugula, cucumber, celery, and radish, then serve with the chicken and asparagus."]
  },
  {
    name: "Mid-Afternoon Snack (Recovery & Refine)", cat: "snack", cal: 190, time: 5, imageKey: "yogurt",
    tags: ["Google Calendar", "recovery", "pre-workout"],
    calendarNote: "1 scoop Whey (or Vegan) Protein and 10-12 Raw Almonds.",
    ingredients: [[1, "scoop", "whey protein"], [12, "pc", "raw almonds"], [1, "cup", "water"]],
    steps: ["Shake the whey protein with water.", "Serve with the raw almonds; vegan protein may be substituted."]
  },
  {
    name: "Dinner (Sleep-Support Meal)", cat: "dinner", cal: 320, time: 30, imageKey: "salmon",
    tags: ["Google Calendar", "sleep-support", "high-protein"],
    calendarNote: "200g White Fish (Cod/Tilapia) or 1.5 cups Cooked Lentils. 1 cup Roasted Pumpkin or Squash. Unlimited Zucchini or Spinach.",
    ingredients: [[200, "g", "white fish"], [1, "cup", "pumpkin"], [1, "cup", "zucchini"], [1, "tsp", "olive oil"]],
    steps: ["Roast the pumpkin and zucchini with olive oil until tender.", "Bake the white fish until opaque and cooked through; cooked lentils may be substituted.", "Serve the fish with the roasted vegetables."]
  },
  {
    name: "Evening Snack (Recovery & Refine)", cat: "snack", cal: 120, time: 5, imageKey: "yogurt",
    tags: ["Google Calendar", "recovery", "quick"],
    calendarNote: "200g Non-fat Greek Yogurt (or Soy Yogurt) + Cinnamon.",
    ingredients: [[200, "g", "non-fat Greek yogurt"], [0.25, "tsp", "cinnamon"]],
    steps: ["Spoon the yogurt into a bowl; unsweetened soy yogurt may be substituted.", "Sprinkle with cinnamon."]
  },
  {
    name: "Breakfast: V-Taper Recovery Day", cat: "breakfast", cal: 350, time: 15, imageKey: "eggs",
    tags: ["Google Calendar", "V-Taper", "recovery"],
    calendarNote: "1.5 cups Egg Whites + 1 Whole Egg scrambled with spinach and mushrooms. 1/2 Grapefruit. (180g Protein Target)",
    ingredients: [[1.5, "cup", "egg whites"], [1, "pc", "whole egg"], [1, "cup", "spinach"], [0.5, "cup", "mushrooms"], [0.5, "pc", "grapefruit"]],
    steps: ["Sauté the spinach and mushrooms in a nonstick pan.", "Add the egg whites and whole egg, then scramble until fully set.", "Serve with half a grapefruit."]
  },
  {
    name: "Lunch: V-Taper Recovery Day", cat: "lunch", cal: 410, time: 30, imageKey: "salad",
    tags: ["Google Calendar", "V-Taper", "recovery"],
    calendarNote: "200g Grilled Chicken Breast + Large Arugula Salad with cucumber + 150g Steamed Asparagus. (180g Protein Target)",
    ingredients: [[200, "g", "chicken breast"], [2, "cup", "arugula"], [1, "cup", "cucumber"], [150, "g", "asparagus"]],
    steps: ["Grill the chicken until its thickest part reaches 74°C.", "Steam the asparagus until crisp-tender.", "Toss the arugula and cucumber, then serve with the chicken and asparagus."]
  },
  {
    name: "Mid-Afternoon Snack: V-Taper Recovery Day", cat: "snack", cal: 190, time: 5, imageKey: "yogurt",
    tags: ["Google Calendar", "V-Taper", "recovery"],
    calendarNote: "1 scoop Whey Protein + 10 Raw Almonds. (180g Protein Target)",
    ingredients: [[1, "scoop", "whey protein"], [10, "pc", "raw almonds"], [1, "cup", "water"]],
    steps: ["Shake the whey protein with water.", "Serve with the raw almonds."]
  },
  {
    name: "Dinner: Deep Sleep Support Meal", cat: "dinner", cal: 330, time: 30, imageKey: "salmon",
    tags: ["Google Calendar", "sleep-support", "high-protein"],
    calendarNote: "200g White Fish + 1 cup Roasted Pumpkin + Unlimited Steamed Broccoli. (180g Protein Target)",
    ingredients: [[200, "g", "white fish"], [1, "cup", "pumpkin"], [2, "cup", "broccoli"], [1, "tsp", "olive oil"]],
    steps: ["Roast the pumpkin with olive oil until tender.", "Steam the broccoli.", "Bake or pan-sear the fish until cooked through and serve with the vegetables."]
  },
  {
    name: "Evening Snack: V-Taper Recovery Day", cat: "snack", cal: 120, time: 5, imageKey: "yogurt",
    tags: ["Google Calendar", "V-Taper", "sleep-support"],
    calendarNote: "200g Non-fat Greek Yogurt + Cinnamon. (180g Protein Target)",
    ingredients: [[200, "g", "non-fat Greek yogurt"], [0.25, "tsp", "cinnamon"]],
    steps: ["Spoon the yogurt into a bowl.", "Sprinkle with cinnamon."]
  },
  {
    name: "Breakfast: V-Taper Foundation Day", cat: "breakfast", cal: 490, time: 15, imageKey: "eggs",
    tags: ["Google Calendar", "V-Taper", "high-protein"],
    calendarNote: "1.5 cups Egg Whites + 2 Whole Eggs. 1/2 cup Oats (dry) with cinnamon. (180g Protein Target)",
    ingredients: [[1.5, "cup", "egg whites"], [2, "pc", "whole egg"], [0.5, "cup", "rolled oats"], [0.25, "tsp", "cinnamon"]],
    steps: ["Cook the oats with water until tender and season with cinnamon.", "Scramble the egg whites and whole eggs until fully set.", "Serve together."]
  },
  {
    name: "Breakfast (T-Boost)", cat: "breakfast", cal: 370, time: 15, imageKey: "eggs",
    tags: ["Google Calendar", "T-Boost", "high-protein"],
    calendarNote: "Focus: Healthy fats and cholesterol for morning hormone synthesis. Menu: 3-4 Whole Eggs, Spinach, and Avocado.",
    ingredients: [[3, "pc", "whole egg"], [1, "cup", "spinach"], [0.5, "pc", "avocado"]],
    steps: ["Wilt the spinach in a nonstick pan.", "Add the beaten eggs and scramble until fully set.", "Serve with sliced avocado."]
  },
  {
    name: "Lunch: V-Taper Foundation Day", cat: "lunch", cal: 480, time: 30, imageKey: "wrap",
    tags: ["Google Calendar", "V-Taper", "high-protein"],
    calendarNote: "200g Grilled Chicken Breast + 2 cups Steamed Asparagus + 1/2 cup Cooked Brown Rice. (180g Protein Target)",
    ingredients: [[200, "g", "chicken breast"], [2, "cup", "asparagus"], [0.5, "cup", "brown rice"]],
    steps: ["Cook the brown rice.", "Grill the chicken until its thickest part reaches 74°C.", "Steam the asparagus and serve with the chicken and rice."]
  },
  {
    name: "Lunch (T-Boost)", cat: "lunch", cal: 580, time: 30, imageKey: "salad",
    tags: ["Google Calendar", "T-Boost", "high-protein"],
    calendarNote: "Focus: Zinc from meat + estrogen-blocking properties of broccoli. Menu: Grilled Chicken or Beef, large serving of Broccoli, and Quinoa.",
    ingredients: [[200, "g", "chicken breast"], [1.5, "cup", "broccoli"], [0.75, "cup", "quinoa"]],
    steps: ["Cook the quinoa.", "Grill the chicken until fully cooked; lean beef may be substituted.", "Steam the broccoli and serve with the chicken and quinoa."]
  },
  {
    name: "Pre-Workout Snack (T-Boost)", cat: "snack", cal: 250, time: 5, imageKey: "apple",
    tags: ["Google Calendar", "T-Boost", "pre-workout"],
    calendarNote: "Focus: Magnesium for muscle function and quick carbs for energy. Menu: Handful of Pumpkin seeds and a piece of fruit.",
    ingredients: [[0.25, "cup", "pumpkin seeds"], [1, "pc", "fresh fruit"]],
    steps: ["Portion the pumpkin seeds.", "Serve with one piece of fresh fruit."]
  },
  {
    name: "Pre-Workout Snack: V-Taper Foundation Day", cat: "snack", cal: 250, time: 5, imageKey: "riceCake",
    tags: ["Google Calendar", "V-Taper", "pre-workout"],
    calendarNote: "1 scoop Whey Protein + 1 Rice Cake with peanut butter. (180g Protein Target)",
    ingredients: [[1, "scoop", "whey protein"], [1, "pc", "rice cake"], [1, "tbsp", "peanut butter"], [1, "cup", "water"]],
    steps: ["Shake the whey protein with water.", "Spread peanut butter over the rice cake and serve with the shake."]
  },
  {
    name: "Dinner (T-Boost)", cat: "dinner", cal: 530, time: 35, imageKey: "salmon",
    tags: ["Google Calendar", "T-Boost", "omega-3"],
    calendarNote: "Focus: Vitamin D, Zinc, and complex carbs to replenish glycogen. Menu: Baked Salmon or Grass-fed Steak with Sweet Potato and Asparagus.",
    ingredients: [[180, "g", "salmon fillet"], [1, "cup", "sweet potato"], [1, "cup", "asparagus"], [1, "tsp", "olive oil"]],
    steps: ["Roast the sweet potato and asparagus with olive oil.", "Bake the salmon until it flakes easily and is cooked through; lean steak may be substituted.", "Serve together."]
  },
  {
    name: "Dinner: V-Taper Foundation Day", cat: "dinner", cal: 390, time: 25, imageKey: "salad",
    tags: ["Google Calendar", "V-Taper", "high-protein"],
    calendarNote: "200g White Fish + Massive Green Salad + 1/2 Avocado. (180g Protein Target)",
    ingredients: [[200, "g", "white fish"], [3, "cup", "mixed salad greens"], [0.5, "pc", "avocado"], [1, "tsp", "olive oil"]],
    steps: ["Bake or pan-sear the fish until cooked through.", "Toss the salad greens with olive oil and top with avocado.", "Serve the fish with the salad."]
  },
  {
    name: "Evening Snack: Sleep-Support", cat: "snack", cal: 250, time: 5, imageKey: "yogurt",
    tags: ["Google Calendar", "sleep-support", "quick"],
    calendarNote: "200g Non-fat Greek Yogurt + Cinnamon + 5 Walnuts. (180g Protein Target)",
    ingredients: [[200, "g", "non-fat Greek yogurt"], [5, "pc", "walnuts"], [0.25, "tsp", "cinnamon"]],
    steps: ["Spoon the yogurt into a bowl.", "Top with walnuts and cinnamon."]
  },
  {
    name: "Meal 1: The Breaking (Ghost Protocol)", cat: "breakfast", cal: 470, time: 15, imageKey: "eggs",
    tags: ["Google Calendar", "Ghost Protocol", "low-processed-carb"],
    calendarNote: "The First Fuel: 4–5 Whole Eggs, 1/2 Avocado/Walnuts, Spinach/Kale. No processed carbs. Focus: Cognitive clarity.",
    ingredients: [[4, "pc", "whole egg"], [0.5, "pc", "avocado"], [1, "cup", "spinach"]],
    steps: ["Wilt the spinach in a nonstick pan.", "Add the beaten eggs and scramble until fully set.", "Serve with avocado; walnuts or kale may be substituted as noted in the calendar."]
  },
  {
    name: "Meal 2: The Monolith (Ghost Protocol)", cat: "lunch", cal: 780, time: 35, imageKey: "salmon",
    tags: ["Google Calendar", "Ghost Protocol", "post-workout"],
    calendarNote: "Post-Workout/Recovery: 250g Grass-fed Beef/Salmon, 1 cup White Rice/Sweet Potato, Roasted Broccoli. Focus: Refueling the Frame.",
    ingredients: [[250, "g", "salmon fillet"], [1, "cup", "white rice"], [1, "cup", "broccoli"], [1, "tsp", "olive oil"]],
    steps: ["Cook the rice.", "Roast the broccoli with olive oil.", "Bake the salmon until cooked through; grass-fed beef or sweet potato may be substituted as noted in the calendar."]
  },
  {
    name: "Meal 3: The Restoration (Ghost Protocol)", cat: "dinner", cal: 480, time: 25, imageKey: "salad",
    tags: ["Google Calendar", "Ghost Protocol", "high-protein"],
    calendarNote: "The Restoration: Chicken/White Fish, Large Green Salad with Olive Oil. Focus: The Silent Meal commandment. Total presence.",
    ingredients: [[180, "g", "chicken breast"], [3, "cup", "mixed salad greens"], [1, "tbsp", "olive oil"]],
    steps: ["Grill the chicken until its thickest part reaches 74°C; white fish may be substituted.", "Toss the salad greens with olive oil.", "Serve mindfully without distractions, following the calendar note."]
  },
  {
    name: "Breakfast: Accelerated 11% Cut", cat: "breakfast", cal: 390, time: 15, imageKey: "eggs",
    tags: ["Google Calendar", "Accelerated 11% Cut", "high-protein"],
    calendarNote: "2 cups Egg Whites + 1 Whole Egg scrambled with spinach & mushrooms + 1/4 cup blueberries. (Accelerated 11% Cut)",
    ingredients: [[2, "cup", "egg whites"], [1, "pc", "whole egg"], [1, "cup", "spinach"], [0.5, "cup", "mushrooms"], [0.25, "cup", "blueberries"]],
    steps: ["Sauté the spinach and mushrooms in a nonstick pan.", "Add the egg whites and whole egg, then scramble until fully set.", "Serve with blueberries."]
  },
  {
    name: "Lunch: Accelerated 11% Cut", cat: "lunch", cal: 510, time: 30, imageKey: "wrap",
    tags: ["Google Calendar", "Accelerated 11% Cut", "high-protein"],
    calendarNote: "220g Grilled Chicken Breast + 3 cups Steamed Broccoli/Asparagus. (Accelerated 11% Cut)",
    ingredients: [[220, "g", "chicken breast"], [1.5, "cup", "broccoli"], [1.5, "cup", "asparagus"]],
    steps: ["Grill the chicken until its thickest part reaches 74°C.", "Steam the broccoli and asparagus until crisp-tender.", "Serve together."]
  },
  {
    name: "Pre-Workout Snack: Accelerated 11% Cut", cat: "snack", cal: 180, time: 5, imageKey: "yogurt",
    tags: ["Google Calendar", "Accelerated 11% Cut", "pre-workout"],
    calendarNote: "1.5 scoops Whey Protein (shaken with water). (Accelerated 11% Cut)",
    ingredients: [[1.5, "scoop", "whey protein"], [1.5, "cup", "water"]],
    steps: ["Shake the whey protein with water until smooth.", "Drink shortly before the planned workout."]
  },
  {
    name: "Dinner: Accelerated 11% Cut", cat: "dinner", cal: 420, time: 25, imageKey: "salad",
    tags: ["Google Calendar", "Accelerated 11% Cut", "high-protein"],
    calendarNote: "250g White Fish + Massive Salad + 1/4 Avocado. (Accelerated 11% Cut)",
    ingredients: [[250, "g", "white fish"], [3, "cup", "mixed salad greens"], [0.25, "pc", "avocado"], [1, "tsp", "olive oil"]],
    steps: ["Bake or pan-sear the fish until opaque and cooked through.", "Toss the salad greens with olive oil and top with avocado.", "Serve the fish with the salad."]
  },
  {
    name: "Evening Snack: Accelerated 11% Cut", cat: "snack", cal: 210, time: 5, imageKey: "yogurt",
    tags: ["Google Calendar", "Accelerated 11% Cut", "sleep-support"],
    calendarNote: "150g Non-fat Greek Yogurt + 1 scoop Casein/Whey. (Accelerated 11% Cut)",
    ingredients: [[150, "g", "non-fat Greek yogurt"], [1, "scoop", "casein protein"]],
    steps: ["Spoon the yogurt into a bowl.", "Stir in casein protein until smooth; whey may be substituted."]
  }
]);

const ONE_OFF_MEALS = Object.freeze({
  "2026-03-02": {
    breakfast: ["Breakfast (V-Taper Foundation)"],
    lunch: ["Lunch (V-Taper Foundation)"],
    dinner: ["Dinner (V-Taper Foundation)"],
    snack: ["Pre-Workout Snack (V-Taper Foundation)", "Evening Snack (Sleep-Support)"]
  },
  "2026-03-03": {
    breakfast: ["Breakfast (Recovery & Refine)"],
    lunch: ["Lunch (Recovery & Refine)"],
    dinner: ["Dinner (Sleep-Support Meal)"],
    snack: ["Mid-Afternoon Snack (Recovery & Refine)", "Evening Snack (Recovery & Refine)"]
  },
  "2026-03-10": {
    breakfast: ["Breakfast: V-Taper Recovery Day"],
    lunch: ["Lunch: V-Taper Recovery Day"],
    dinner: ["Dinner: Deep Sleep Support Meal"],
    snack: ["Mid-Afternoon Snack: V-Taper Recovery Day", "Evening Snack: V-Taper Recovery Day"]
  },
  "2026-03-11": {
    breakfast: ["Breakfast: V-Taper Foundation Day"],
    lunch: ["Lunch: V-Taper Foundation Day"],
    dinner: ["Dinner: V-Taper Foundation Day"],
    snack: ["Pre-Workout Snack: V-Taper Foundation Day", "Evening Snack: Sleep-Support"]
  }
});

const RECURRING_MEALS = Object.freeze([
  { start: "2026-03-11", meal: "breakfast", name: "Breakfast (T-Boost)" },
  { start: "2026-03-11", meal: "lunch", name: "Lunch (T-Boost)" },
  { start: "2026-03-11", meal: "snack", name: "Pre-Workout Snack (T-Boost)" },
  { start: "2026-03-11", meal: "dinner", name: "Dinner (T-Boost)" },
  { start: "2026-03-12", meal: "breakfast", name: "Meal 1: The Breaking (Ghost Protocol)" },
  { start: "2026-03-12", meal: "lunch", name: "Meal 2: The Monolith (Ghost Protocol)" },
  { start: "2026-03-12", meal: "dinner", name: "Meal 3: The Restoration (Ghost Protocol)" },
  { start: "2026-03-16", meal: "breakfast", name: "Breakfast: Accelerated 11% Cut" },
  { start: "2026-03-16", meal: "lunch", name: "Lunch: Accelerated 11% Cut" },
  { start: "2026-03-16", meal: "snack", name: "Pre-Workout Snack: Accelerated 11% Cut" },
  { start: "2026-03-16", meal: "dinner", name: "Dinner: Accelerated 11% Cut" },
  { start: "2026-03-16", meal: "snack", name: "Evening Snack: Accelerated 11% Cut" }
]);

export function calendarMealNamesForDate(date) {
  const result = { breakfast: [], lunch: [], dinner: [], snack: [] };
  const add = (meal, name) => {
    if (!result[meal].includes(name)) result[meal].push(name);
  };
  const oneOff = ONE_OFF_MEALS[date];
  if (oneOff) Object.entries(oneOff).forEach(([meal, names]) => names.forEach((name) => add(meal, name)));
  RECURRING_MEALS.forEach((entry) => {
    if (date >= entry.start) add(entry.meal, entry.name);
  });
  return result;
}

export function calendarMealCountForDates(dates = []) {
  return dates.reduce((total, date) => total + Object.values(calendarMealNamesForDate(date))
    .reduce((dayTotal, names) => dayTotal + names.length, 0), 0);
}
