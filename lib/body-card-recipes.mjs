export const BODY_CARD_SOURCE_URL = "https://body-card.ajmillertperez562.chatgpt.site/#nutrition";

const meal = (name, cat, cal, time, imageKey, ingredients, steps, description, cost, tags = []) => ({
  name, cat, cal, time, imageKey, ingredients, steps,
  tags: ["Body Card", "estimated-calories", "flexible-portions", ...tags],
  source: "Body Card",
  sourceUrl: BODY_CARD_SOURCE_URL,
  sourceNote: `${description} Imported from Body Card Nutrition. Body Card lists flexible portions; NourishPlan added example quantities for one serving and rough calorie estimates for meal planning. Adjust quantities to your appetite and care plan. Body Card's original cost range is ${cost} per serving, a rough estimate rather than a live price.`
});

export const BODY_CARD_RECIPES = Object.freeze([
  meal("Oats, yogurt & banana", "breakfast", 350, 10, "oats",
    [[0.5, "cup", "rolled oats"], [0.5, "cup", "plain unsweetened yogurt"], [1, "pc", "banana"], [1, "tbsp", "unsalted nuts"], [1, "cup", "water"]],
    ["Cook a portion of oats in water or your usual milk.", "Top with plain yogurt, sliced banana and a small amount of nuts.", "Adjust portions to appetite and your care plan."],
    "A simple bowl with fiber, a protein food and whole fruit. Use unsweetened soy yogurt if preferred.", "₱55–90", ["vegetarian"]),
  meal("Egg & vegetable breakfast", "breakfast", 330, 15, "eggs",
    [[2, "", "egg"], [0.5, "cup", "tomato"], [1, "cup", "leafy vegetables"], [1, "slice", "whole-grain bread"], [1, "tsp", "olive oil"]],
    ["Cook eggs with tomatoes and greens using a small amount of oil.", "Serve with whole-grain bread or a measured portion of rice.", "Season lightly and add pepper or herbs."],
    "An easy savory option with vegetables and a carbohydrate portion of your choice.", "₱45–80", ["vegetarian"]),
  meal("Chicken tinola bowl", "lunch", 390, 35, "soup",
    [[120, "g", "skinless chicken"], [1, "cup", "sayote"], [1, "cup", "malunggay"], [1, "tsp", "ginger"], [0.5, "cup", "cooked brown rice"], [1.5, "cup", "water"]],
    ["Simmer ginger and chicken until the chicken is thoroughly cooked.", "Add sayote and malunggay; cook until tender.", "Serve with rice. Keep sauces and salty condiments modest."],
    "A vegetable-forward Filipino staple. Use skinless chicken and season the broth lightly.", "₱95–150", ["Filipino"]),
  meal("Tofu & vegetable rice bowl", "lunch", 410, 20, "tofu",
    [[150, "g", "tofu"], [1, "cup", "cabbage"], [0.5, "cup", "carrot"], [0.5, "cup", "cooked brown rice"], [1, "clove", "garlic"], [1, "tsp", "olive oil"]],
    ["Pan-cook cubed tofu with a small amount of oil.", "Add garlic and chopped cabbage and carrots.", "Serve over rice; use a modest amount of your preferred sauce."],
    "A flexible everyday bowl with tofu, colorful vegetables and rice.", "₱60–100", ["plant-protein"]),
  meal("Vegetable monggo", "dinner", 380, 35, "soup",
    [[0.33, "cup", "dry mung beans"], [1, "cup", "malunggay"], [0.5, "cup", "tomato"], [1, "clove", "garlic"], [0.5, "cup", "cooked brown rice"], [2, "cup", "water"]],
    ["Simmer rinsed mung beans until fully tender.", "Cook garlic and tomatoes and add to the beans.", "Stir in malunggay and serve with a portion of rice."],
    "A budget-friendly bean-and-vegetable meal. Skip processed meat and season to taste.", "₱45–80", ["Filipino", "plant-protein"]),
  meal("Chicken & roasted vegetables", "dinner", 400, 30, "chickenVegetables",
    [[120, "g", "skinless chicken"], [1, "cup", "squash"], [1, "cup", "green beans"], [100, "g", "camote"], [1, "tbsp", "calamansi juice"]],
    ["Cook skinless chicken thoroughly with herbs and calamansi.", "Roast or steam squash, green beans and camote.", "Choose portions that match your appetite and nutrition plan."],
    "A protein food with plenty of vegetables and an adaptable starchy side.", "₱100–160"),
  meal("Fruit & plain yogurt", "snack", 130, 5, "yogurt",
    [[1, "cup", "papaya"], [0.5, "cup", "plain unsweetened yogurt"]],
    ["Slice washed papaya or another seasonal fruit.", "Serve with plain yogurt without sweetened syrup."],
    "A quick whole-fruit snack with plain yogurt; use an alternative that suits your needs.", "₱40–75", ["vegetarian"])
]);
