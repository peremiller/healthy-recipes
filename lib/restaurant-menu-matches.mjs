// Reviewed public menu facts, retrieved 2026-11-07. These identify related
// dishes, not the app recipe's ingredients, portions, or dietary suitability.
// Denny's Philippines official PDF: pages 3, 8, 15, 19, 20, 22, 29, 31.
const DENNYS_MENU = "https://dennys.ph/assets/pdf/Dennys_Menu.pdf";
const MCD_MENU = "https://www.mcdonalds.com.ph/our-food/";
export const MENU_COVERAGE = { brands: ["Denny's", "McDonald's"], checkedAt: "2026-11-07" };
const item = (name, mealKeys, sourceUrl) => ({ name, mealKeys, sourceUrl });
const DENNYS = [
  item("Cheesy Omu Rice", ["egg-plate"], DENNYS_MENU + "#page=20"),
  item("Mighty Truffle ’Shroom omelette", ["omelette"], DENNYS_MENU + "#page=20"),
  item("Eggplant Tortalette", ["eggplant-omelette"], DENNYS_MENU + "#page=20"),
  item("Berry Good Yogurt", ["yogurt"], DENNYS_MENU + "#page=19"),
  item("Caesar Salad", ["caesar-salad"], DENNYS_MENU + "#page=15"),
  item("Caesar Salad with Grilled Chicken Breast", ["chicken-salad"], DENNYS_MENU + "#page=15"),
  item("Creamy Bacon Carbonara", ["carbonara"], DENNYS_MENU + "#page=29"),
  item("Savannah Shrimp pasta", ["seafood-pasta"], DENNYS_MENU + "#page=29"),
  item("Mom’s Spaghetti", ["spaghetti"], DENNYS_MENU + "#page=29"),
  item("The Champ’s Cheesy Penne", ["cheese-pasta"], DENNYS_MENU + "#page=29"),
  item("Clam Chowder", ["clam-chowder"], DENNYS_MENU + "#page=15"),
  item("Arroz Caldo with Grilled Chicken Breast add-on", ["chicken-porridge"], DENNYS_MENU + "#page=19"),
  item("Chicken Teriyaki", ["chicken-teriyaki"], DENNYS_MENU + "#page=26"),
  item("Dulce de Leche Cheesecake", ["cheesecake"], DENNYS_MENU + "#page=31"),
  item("Biscoff Ice Cream Crème Brûlée", ["ice-cream"], DENNYS_MENU + "#page=31"),
  item("Brewed coffee", ["coffee"], DENNYS_MENU + "#page=3"),
  item("Hot Tea · Chamomile", ["chamomile-tea"], DENNYS_MENU + "#page=3")
];
const MCD = [
  item("Hot Fudge Sundae", ["ice-cream"], MCD_MENU + "drinks-desserts"),
  item("Vanilla Sundae Cone", ["ice-cream"], MCD_MENU + "drinks-desserts"),
  item("McCafé Premium Roast Coffee", ["coffee"], MCD_MENU + "drinks-desserts"),
  item("Chicken McDo with McSpaghetti", ["spaghetti"], MCD_MENU + "chicken-platters"),
  item("Chicken McDo with Rice", ["fried-chicken"], MCD_MENU + "chicken-platters")
];

export function mealDiningKeys(recipe) {
  let text = String(recipe?.name || "").toLowerCase();
  // Program labels are not food. Only use their actual ingredients/preparation.
  if (/v-taper|t-boost|ghost protocol|accelerated|recovery|sleep-support/.test(text)) {
    text = [...(recipe.ingredients || []).map((food) => food.name), ...(recipe.steps || [])].join(" ").toLowerCase();
  }
  // More specific dishes take precedence. Never match an incidental egg in a
  // pasta dish, an oat bowl to a yogurt dessert, or adobo to fried chicken.
  const rules = [
    [/tinola|monggo|pinakbet|kare.kare|sisig|pancit|adobo|sinigang|falafel|hummus|lentil|tofu|tokwa|oat|porridge|chia pudding/, "uncovered"],
    [/carbonara/, "carbonara"],
    [/chicken.*teriyaki|teriyaki.*chicken/, "chicken-teriyaki"],
    [/(seafood|shrimp|prawn).*(pasta|linguine|spaghetti)|(pasta|linguine|spaghetti).*(seafood|shrimp|prawn)/, "seafood-pasta"],
    [/spaghetti/, "spaghetti"],
    [/(cheese|cheesy).*(penne|pasta)|(penne|pasta).*(cheese|cheesy)/, "cheese-pasta"],
    [/eggplant.*(omelet|torta|frittata)/, "eggplant-omelette"],
    [/omelet|omelette|frittata/, "omelette"],
    [/egg.*(plate|breakfast)|scrambled egg/, "egg-plate"],
    [/caesar.*salad|salad.*caesar/, "caesar-salad"],
    [/chicken.*salad|salad.*chicken/, "chicken-salad"],
    [/clam.*chowder/, "clam-chowder"],
    [/cheesecake/, "cheesecake"],
    [/ice cream|sundae|mcflurry/, "ice-cream"],
    [/yogurt|yoghurt|parfait/, "yogurt"],
    [/coffee|espresso|cappuccino|latte/, "coffee"],
    [/chamomile.*tea|tea.*chamomile/, "chamomile-tea"],
    [/(fried|crispy).*chicken|chicken.*(fried|crispy)/, "fried-chicken"]
  ];
  const key = rules.find(([pattern]) => pattern.test(text))?.[1];
  return key && key !== "uncovered" ? [key] : [];
}

export function menuMatchesForMeal(recipe, place, { keys = mealDiningKeys(recipe) } = {}) {
  const brand = String(place.brand || place.name || "");
  const menu = Array.isArray(place.menuItems) ? place.menuItems
    : /denny['’]?s/i.test(brand) ? DENNYS : /mcdonald['’]?s/i.test(brand) ? MCD : [];
  return menu.filter((food) => food.name && food.sourceUrl && Array.isArray(food.mealKeys) && food.mealKeys.some((key) => keys.includes(key)));
}
