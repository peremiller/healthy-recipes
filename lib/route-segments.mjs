// Reject malformed percent escapes without throwing during SPA route rendering.
// Valid legacy slugs and encoded Unicode segments continue to decode normally.
export function decodeRouteSegment(segment) {
  try {
    return decodeURIComponent(segment || "");
  } catch {
    return null;
  }
}
