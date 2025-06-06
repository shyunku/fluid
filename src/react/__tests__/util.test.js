import { changed } from "../util";

describe("changed function", () => {
  test("should return false for same primitives", () => {
    expect(changed(1, 1)).toBe(false);
    expect(changed("a", "a")).toBe(false);
    expect(changed(true, true)).toBe(false);
  });

  test("should return true for different primitives", () => {
    expect(changed(1, 2)).toBe(true);
    expect(changed("a", "b")).toBe(true);
    expect(changed(true, false)).toBe(true);
  });

  test("should return false for same objects", () => {
    const obj1 = { a: 1, b: { c: 2 } };
    const obj2 = { a: 1, b: { c: 2 } };
    expect(changed(obj1, obj2)).toBe(false);
  });

  test("should return true for different objects", () => {
    const obj1 = { a: 1, b: { c: 2 } };
    const obj2 = { a: 1, b: { c: 3 } };
    expect(changed(obj1, obj2)).toBe(true);
  });

  test("should return false for same arrays", () => {
    const arr1 = [1, [2, 3]];
    const arr2 = [1, [2, 3]];
    expect(changed(arr1, arr2)).toBe(false);
  });

  test("should return true for different arrays", () => {
    const arr1 = [1, [2, 3]];
    const arr2 = [1, [2, 4]];
    expect(changed(arr1, arr2)).toBe(true);
  });

  test("should handle null and undefined", () => {
    expect(changed(null, null)).toBe(false);
    expect(changed(undefined, undefined)).toBe(false);
    expect(changed(null, undefined)).toBe(true);
    expect(changed(0, null)).toBe(true);
  });
});
