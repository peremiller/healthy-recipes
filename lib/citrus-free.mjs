// Keep older device/cloud backups consistent with the current recipe collection.
const CITRUS = /\b(?:citrus|lemons?|lemony|lemonade|limes?|calamansi|kalamansi|calamondin|grapefruits?|pomelos?|mandarins?|tangerines?|clementines?|satsumas?|yuzu|bergamot|kumquats?|citron|dalandan|dalanghita|ponkan|suha|dayap|makrut|oranges?(?!\s+(?:vegetables|squash)))\b/i;

export function containsCitrus(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return CITRUS.test(text.replace(/citrus[ -]free/gi, ""));
}

const LEGACY_NAMES = new Map([
  ["Calamansi Salmon with Okra & Barley", "Ginger Salmon with Okra & Barley"],
  ["Citrus-Herb Grilled Chicken Bowl", "Garlic-Herb Grilled Chicken Bowl"],
  ["Calamansi chicken grain bowl", "Garlic yogurt chicken grain bowl"],
  ["Cucumber calamansi green tea", "Cucumber mint green tea"],
  ["Grapefruit Orange Ginger Juice", "Apple Pear Ginger Juice"],
  ["Orange Turmeric Ginger Juice", "Carrot Turmeric Ginger Juice"],
  ["Lemon Chamomile Tea", "Ginger Chamomile Tea"],
  ["Cilantro-Lime Tilapia with Spinach & Tomatoes", "Cilantro Tilapia with Spinach & Tomatoes"],
  ["Lemon-Yogurt Chicken Flatbreads", "Herb-Yogurt Chicken Flatbreads"],
  ["Lemon Chicken Piccata", "Caper Chicken Piccata"],
  ["Lemon Spaghetti with Tuna & Broccoli", "Garlic-Herb Spaghetti with Tuna & Broccoli"],
  ["Lemony Tuna, Tomato & Caper One-Pot Pasta", "Tuna, Tomato & Caper One-Pot Pasta"],
  ["Calamansi-Garlic Shrimp Pasta", "Garlic-Herb Shrimp Pasta"],
  ["Dark Chocolate & Orange Pancakes", "Dark Chocolate & Banana Pancakes"],
  ["Savory Sardine & Lemon Spread", "Savory Sardine & Herb Spread"],
  ["Tuna Calamansi Yogurt Spread", "Tuna Cucumber Yogurt Spread"],
  ["Lemon Tea Infusion", "Ginger Mint Tea Infusion"]
]);
const key = (name) => String(name || "").trim().toLowerCase();
const legacyNames = new Map([...LEGACY_NAMES].map(([before, after]) => [key(before), key(after)]));

export function replaceCitrusInState(data, templates) {
  const byName = new Map(templates.map((item) => [key(item.name), item]));
  data.recipes = data.recipes.flatMap((item) => {
    const content = [item.name, item.ingredients, item.steps, item.tags, item.aliases, item.sourceNote, item.sourceNotes];
    const refreshPreparedFood = Number(data.contentVersion) < 17 && ["Hummus & Veggie Sticks", "Garden Salad"].includes(item.name);
    if (!containsCitrus(content) && !refreshPreparedFood) return [item];
    const template = byName.get(legacyNames.get(key(item.name)) || key(item.name));
    // Known dishes receive reviewed replacements; unrecognized imported citrus dishes are removed.
    if (!template) return [];
    const replacement = { ...item, ...structuredClone(template), id: item.id };
    if (item.visualMode === "custom") {
      replacement.image = item.image;
      replacement.visualMode = "custom";
    }
    return [replacement];
  });
  // Pantry stock is physical: never relabel existing fruit as stock of its replacement.
  data.inventory = data.inventory.filter((item) => !containsCitrus(item.name));
  data.extras = data.extras.filter((item) => !containsCitrus(item.name));
  data.checked = Object.fromEntries(Object.entries(data.checked).filter(([name]) => !containsCitrus(name)));
  return data;
}
