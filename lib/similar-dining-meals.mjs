// Bounded, explainable meal analogies. A suggestion only becomes a restaurant
// result after its dish key matches a reviewed menu at an open nearby venue.
// Scores express similarity, never nutrition or diabetic suitability.
const choice = (key, name, score, reason, differences, excludes = []) => ({ key, name, score, reason, differences, excludes });

export function similarDiningMeals(recipe) {
  const name = String(recipe?.name || "").toLowerCase();
  const ingredients = (recipe?.ingredients || []).map((food) => String(food.name || "")).join(" ").toLowerCase();
  const preparation = (recipe?.steps || []).filter((step) => typeof step === "string").join(" ").toLowerCase();
  const program = /v-taper|t-boost|ghost protocol|accelerated|recovery|sleep-support/.test(name);
  const text = program ? `${ingredients} ${preparation}` : name;
  let suggestions = [];
  if (/tinola|chicken.*(soup|broth|porridge)|arroz caldo/.test(text)) {
    suggestions = [choice("chicken-porridge", "Chicken arroz caldo", 95,
      "Keeps chicken, rice and a warm, spoonable meal.",
      "Rice porridge replaces the clear broth; vegetables, seasoning and portions differ.", ["vegetarian", "vegan", "egg-free"])];
  } else if (/yogurt|yoghurt|parfait/.test(text) && !/savory|tofu|tokwa|pechay/.test(text)) {
    suggestions = [choice("yogurt", "Yogurt, berries and granola bowl", 90,
      "Keeps a soft breakfast or snack bowl with fruit and a cereal or seed topping.",
      "Dairy yogurt and granola may replace soy, oats or chia; sugar and portions need checking.", ["vegan", "dairy-free", "gluten-free", "nut-free"])];
  } else if (/mushroom.*(sisig|tofu|tokwa)|(?:tofu|tokwa).*mushroom/.test(text)) {
    suggestions = [choice("tofu-mushroom", "Tofu and mushroom stir-fry", 90,
      "Keeps tofu and mushrooms as the main ingredients.",
      "Stir-fried vegetables and sauce may replace the lettuce-cup presentation.")];
  } else if (/pinakbet|vegetable.*kare.kare|eggplant/.test(text)) {
    suggestions = [choice("vegetable-tofu-rice", "Mixed vegetables and tofu with rice", 88,
      "Keeps vegetables, tofu and a grain side.",
      "The vegetable selection, grain, sauce and portions may differ.")];
  } else if (/falafel/.test(text)) {
    suggestions = [choice("chickpea-bowl", "Chickpea and vegetable bowl", 88,
      "Keeps chickpeas as the main plant protein.",
      "Whole chickpeas may replace falafel; grain, dressing and portions may differ.")];
  } else if (/(chicken.*(?:grill|roast|bowl|rice)|(?:grill|roast).*chicken)/.test(text) ||
      (program && /chicken/.test(ingredients) && /grill|roast/.test(preparation))) {
    suggestions = [choice("chicken-teriyaki", "Grilled chicken with rice and vegetables", 88,
      "Keeps grilled chicken with a grain side and vegetables.",
      "Teriyaki sauce and white rice replace the recipe's seasoning and grain; request sauce and portions to suit your needs.", ["vegetarian", "vegan", "egg-free", "gluten-free"]),
    choice("chicken-salad", "Grilled chicken salad", 80,
      "Keeps grilled chicken and vegetables.",
      "Romaine and dressing replace the cooked vegetables and grain side.", ["vegetarian", "vegan", "dairy-free", "egg-free", "gluten-free"])];
  } else if (/salmon|fish|bangus|milkfish|tilapia|lapu.lapu|grouper/.test(text)) {
    const method = /steam/.test(`${text} ${preparation}`) ? "Steamed" : /bake|roast/.test(`${text} ${preparation}`) ? "Baked" : "Grilled";
    const fish = /bangus|milkfish/.test(text) ? "bangus" : /tilapia/.test(text) ? "tilapia" : /lapu.lapu|grouper/.test(text) ? "lapu-lapu" : /salmon/.test(text) ? "salmon" : null;
    const types = [...(fish ? [fish] : []), ...["bangus", "tilapia", "lapu-lapu", "salmon"].filter((type) => type !== fish)].slice(0, 4);
    suggestions = types.map((type, index) => choice(`fish-${type}-${method.toLowerCase()}`, `${method} ${type} with vegetables`, 95 - index * 5,
      index === 0 ? "Keeps fish as the main ingredient and uses a similar preparation." : "Keeps fish as the main ingredient instead of substituting poultry or meat.",
      `${type === fish || !fish ? "Fish variety, sauce, sides and portions" : `The fish changes from ${fish} to ${type}; sauce, sides and portions`} may differ. Nutrient content is not assumed equivalent.`, ["vegetarian", "vegan"]));
  } else if (/carbonara|pasta|spaghetti|linguine|gnocchi|ragu|pancit/.test(text)) {
    suggestions = [choice("spaghetti", "Spaghetti with tomato sauce", 83,
      "Keeps a noodle or pasta meal with sauce.",
      "Pasta shape, sauce and toppings differ; meat, allergens and portions need confirmation.", ["vegetarian", "vegan", "gluten-free"]),
    choice("cheese-pasta", "Cheesy penne pasta", 75,
      "Keeps a sauced pasta meal.",
      "Penne, cheese sauce and bacon replace the original pasta and toppings.", ["vegetarian", "vegan", "dairy-free", "gluten-free"])];
  } else if (/salad/.test(text)) {
    suggestions = [choice("caesar-salad", "Romaine Caesar salad", 75,
      "Keeps a cold vegetable salad.",
      "Romaine, croutons, cheese and Caesar dressing replace the original produce and dressing.", ["vegetarian", "vegan", "dairy-free", "egg-free", "gluten-free"])];
  } else if (/bingsu|frozen.*yogurt|gelato/.test(text)) {
    suggestions = [choice("ice-cream", "Ice cream dessert", 80,
      "Keeps a cold, spoonable dessert.",
      "Ice cream and its toppings replace the original frozen base and fruit; sugar and portions differ.", ["vegan", "dairy-free", "gluten-free"])];
  }

  const tags = new Set((Array.isArray(recipe?.tags) ? recipe.tags : []).map((tag) => String(tag).trim().toLowerCase().replace(/[ _]+/g, "-")));
  // Honor explicit dietary constraints; restaurant items still need individual
  // allergen, portion and medical-diet confirmation. Do not infer a constraint
  // solely from a recipe's calorie count or the presence of tofu.
  if (tags.has("plant-based")) tags.add("vegan");
  if (tags.has("no-nuts")) tags.add("nut-free");
  if (tags.has("no-dairy")) tags.add("dairy-free");
  return suggestions.filter((suggestion) => !suggestion.excludes.some((tag) => tags.has(tag)))
    .sort((a, b) => b.score - a.score).slice(0, 4);
}
