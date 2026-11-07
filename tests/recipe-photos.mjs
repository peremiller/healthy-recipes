import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { RECIPE_VISUAL_MANIFEST, recipeVisualSignature, resolveRecipeVisual } from "../lib/recipe-photos.mjs";

const storage = new Map();
const appElement = { innerHTML: "" };
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
globalThis.history = { pushState() {}, replaceState() {} };
globalThis.window = { location: { pathname: "/recipes" }, matchMedia: () => ({ matches: false }), addEventListener() {}, scrollTo() {}, confirm: () => true };
globalThis.document = {
  title: "", addEventListener() {}, body: { classList: { add() {}, remove() {} }, style: {} },
  querySelector: (selector) => selector === "#app" ? appElement : null,
  querySelectorAll: () => [],
  createElement: () => ({ classList: { add() {}, remove() {} }, remove() {}, click() {}, style: {} })
};
await import("../app.js?test=recipe-visual-audit");
const recipes = JSON.parse(storage.get("nourishplan.v2")).recipes;
assert.equal(recipes.length, 152, "the current managed recipe collection must be audited in full");
assert.equal(RECIPE_VISUAL_MANIFEST.length, recipes.length);
const cells = new Set();
for (const recipe of recipes) {
  const visual = resolveRecipeVisual(recipe);
  assert.equal(visual.status, "reviewed", recipe.name);
  assert.equal(visual.kind, "illustration");
  assert.equal(visual.label, "Recipe illustration");
  assert.equal(visual.name, recipe.name);
  assert.ok(visual.src.startsWith("/assets/food/recipe-atlas-"));
  assert.ok(visual.sourceRect.x >= 0 && visual.sourceRect.y >= 0);
  assert.ok(visual.sourceRect.x + visual.sourceRect.width <= visual.width);
  assert.ok(visual.sourceRect.y + visual.sourceRect.height <= visual.height);
  const cell = `${visual.src}|${visual.row}|${visual.column}`;
  assert.ok(!cells.has(cell), `${recipe.name} must have its own reviewed recipe image`);
  cells.add(cell);
  for (const alias of visual.aliases) assert.equal(resolveRecipeVisual({ ...recipe, name: alias }).recipeIndex, visual.recipeIndex);
  assert.equal(resolveRecipeVisual({ ...recipe, ingredients: [...recipe.ingredients, { name: "unreviewed new food" }] }).src, null, "changed food cannot inherit an old image");
  assert.equal(resolveRecipeVisual({ ...recipe, steps: ["Poach these ingredients instead of the reviewed method."] }).src, null, "a changed method cannot inherit an old image");
}
assert.equal(cells.size, 152);
assert.equal(resolveRecipeVisual(null).src, null);
assert.equal(resolveRecipeVisual({ name: "Unknown dish", cat: "dinner", ingredients: [] }).src, null, "never fall back by category");
const sample = recipes[0];
const custom = { ...sample, visualMode: "custom", image: "https://example.com/my-photo.jpg", photoConfirmed: true };
assert.equal(resolveRecipeVisual(custom).src, null, "a URL and checkbox alone are not a review tied to the recipe");
custom.photoReview = { confirmed: true, url: custom.image, name: custom.name, ingredientSignature: recipeVisualSignature(custom) };
assert.equal(resolveRecipeVisual(custom).kind, "user-photo");
assert.equal(resolveRecipeVisual(custom).label, "User-confirmed photo");
assert.equal(resolveRecipeVisual({ ...custom, image: "https://example.com/other-photo.jpg" }).src, null);
assert.equal(resolveRecipeVisual({ ...custom, name: "Different dish" }).src, null);
assert.equal(resolveRecipeVisual({ ...custom, ingredients: [...custom.ingredients, { name: "different food" }] }).src, null);
assert.equal(resolveRecipeVisual({ ...custom, steps: ["Use a different preparation."] }).src, null);
assert.equal(resolveRecipeVisual({ ...custom, photoConfirmed: false }).src, null);
for (const image of ["javascript:alert(1)", "data:image/svg+xml,anything", "file:///private.png", "http://example.com/photo.jpg", "https://secret@example.com/a.png"]) {
  assert.equal(resolveRecipeVisual({ ...custom, image, photoReview: { ...custom.photoReview, url: image } }).src, null, "unsafe custom URLs must not render");
}
let bytes = 0;
const audit = JSON.parse(await readFile(new URL("../docs/recipe-visual-audit.json", import.meta.url), "utf8"));
assert.equal(audit.reviewedRecipeIllustrations, recipes.length);
const files = new Set(RECIPE_VISUAL_MANIFEST.map((entry) => entry.src));
assert.equal(files.size, 10);
for (const src of files) {
  const file = new URL(`..${src}`, import.meta.url);
  const content = await readFile(file);
  assert.equal(content.subarray(0, 4).toString(), "RIFF");
  assert.equal(content.subarray(8, 12).toString(), "WEBP");
  assert.ok((await stat(file)).size > 10_000, "runtime atlases cannot be empty or truncated");
  assert.equal(createHash("sha256").update(content).digest("hex"), audit.atlases.find((atlas) => atlas.path === src)?.sha256, "runtime bytes must match the reviewed production atlas");
  bytes += content.length;
}
assert.ok(bytes < 10_000_000, "the complete illustration set should remain practical to save offline");
console.log(`Recipe visual checks passed: ${recipes.length} distinct reviewed cells, aliases and changed-recipe guards, explicit custom-photo review, ${files.size} local WebP assets (${bytes} bytes).`);
