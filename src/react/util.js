/**
 * 두 값의 변경 여부를 재귀적으로 확인합니다.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function changed(a, b) {
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

/**
 * a 와 b 를 비교해서 다른 부분을 로그로 남깁니다.
 * @param {*} a
 * @param {*} b
 */
export function changedLog(a, b) {
  const diffs = [];

  function recurse(x, y, path) {
    // 완전 동일
    if (Object.is(x, y)) return;

    // null 혹은 undefined 비교
    if (x == null || y == null) {
      diffs.push(`${path}: ${x} ≠ ${y}`);
      return;
    }

    // 원시 타입 비교
    if (typeof x !== "object" || typeof y !== "object") {
      diffs.push(`${path}: ${x} ≠ ${y}`);
      return;
    }

    // 배열 비교
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) {
        diffs.push(`${path}.length: ${x.length} ≠ ${y.length}`);
      }
      const len = Math.min(x.length, y.length);
      for (let i = 0; i < len; i++) {
        recurse(x[i], y[i], `${path}[${i}]`);
      }
      return;
    }

    // 객체 비교
    const keysX = Object.keys(x);
    const keysY = Object.keys(y);
    // 키 길이 차이
    if (keysX.length !== keysY.length) {
      diffs.push(`${path} keys length: ${keysX.length} ≠ ${keysY.length}`);
    }
    // 공통 키에 대한 재귀
    const allKeys = new Set([...keysX, ...keysY]);
    allKeys.forEach((key) => {
      if (!(key in x)) {
        diffs.push(`${path}.${key}: <missing in a> ≠ ${y[key]}`);
      } else if (!(key in y)) {
        diffs.push(`${path}.${key}: ${x[key]} ≠ <missing in b>`);
      } else {
        recurse(x[key], y[key], `${path}.${key}`);
      }
    });
  }

  recurse(a, b, "root");

  if (diffs.length === 0) {
    console.log("No differences found.");
  } else {
    console.log("Differences:");
    diffs.forEach((line) => console.log("  -", line));
  }
}

/**
 * 배열에서 특정 값을 제거합니다.
 * @param {any[]} arr
 * @param {*} value
 */
export function removeFromArray(arr, value) {
  const index = arr.indexOf(value);
  if (index > -1) arr.splice(index, 1);
}

/**
 * 배열을 재귀적으로 평탄화합니다.
 * @param {any[]} arr
 * @returns {any[]}
 */
export function flatten(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.flat().reduce((acc, cur) => {
    return acc.concat(flatten(cur));
  }, []);
}
