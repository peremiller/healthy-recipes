import test from "node:test";
import assert from "node:assert/strict";
import { decodeRouteSegment } from "../lib/route-segments.mjs";

test("valid legacy and Unicode route segments remain readable", () => {
  assert.equal(decodeRouteSegment("salmon-bowl-abc123"), "salmon-bowl-abc123");
  assert.equal(decodeRouteSegment("jalape%C3%B1o"), "jalapeño");
  assert.equal(decodeRouteSegment("grocery%20item"), "grocery item");
  assert.equal(decodeRouteSegment(""), "");
});

test("malformed percent escapes return not-found sentinel instead of crashing navigation", () => {
  for (const input of ["%", "%XZ", "%E0%A4%A", "%FF", "abc%2"]) {
    assert.equal(decodeRouteSegment(input), null, input);
  }
});
