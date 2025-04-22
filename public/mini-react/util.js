function changed(a, b) {
  if (a === b) return false;
  if (a == null || b == null) return a !== b;
  if (typeof a !== "object" || typeof b !== "object") return a !== b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return true;
    return a.some((item, index) => changed(item, b[index]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return true;
  return keysA.some((key) => changed(a[key], b[key]));
}
