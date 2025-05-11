/*
  Mini JSX-to-h Transformer
  =========================
  Simplified runtime JSX parser and transformer based solely on vanilla JS.
  Handles nested tags, self-closing tags, props with {expressions}, and children.
*/

// Unified regex: handles both open-close and self-closing tags
const unifiedTagRegex =
  /<([A-Za-z][A-Za-z0-9]*)\b([^>]*?)>([\s\S]*?)<\/\1>|<([A-Za-z][A-Za-z0-9]*)\b([^>]*?)\/>/gs;

const scripts = document.querySelectorAll('script[type="text/jsx"]');
scripts.forEach(async (script) => {
  const res = await fetch(script.src);
  const code = await res.text();
  const newCode = convertJsxToH(code);
  // Blob + module 스크립트 주입
  const blob = new Blob([newCode], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const tag = document.createElement("script");
  tag.type = "module";
  tag.src = url;
  document.head.appendChild(tag);
});

/**
 * Main entry: convert JSX source (string) to h() calls
 */
function convertJsxToH(source) {
  return source.replace(
    unifiedTagRegex,
    (match, tag1, props1, inner, tag2, props2) => {
      const tag = tag1 || tag2;
      const rawProps = (props1 || props2 || "").trim();
      const propsCode = transformProps(rawProps);
      const childrenCode = inner ? transformChildren(inner) : "";
      return `h('${tag}', ${propsCode || "null"}${
        childrenCode ? `, ${childrenCode}` : ""
      })`;
    }
  );
}

/**
 * Recursively transform children of a JSX fragment
 */
function transformChildren(fragment) {
  let result = [];
  let lastIndex = 0;

  for (const match of fragment.matchAll(unifiedTagRegex)) {
    // add any preceding text node
    if (match.index > lastIndex) {
      const text = fragment.slice(lastIndex, match.index).trim();
      if (text) result.push(JSON.stringify(text));
    }

    // determine which alternative matched
    const isSelf = !!match[1];
    const tag = isSelf ? match[1] : match[3];
    const propsRaw = isSelf ? match[2] : match[4];
    const childrenRaw = isSelf ? "" : match[5];

    const propsObj = transformProps(propsRaw);
    const childrenNodes = childrenRaw ? transformChildren(childrenRaw) : [];

    // build the h() call
    const propsCode = propsObj === "{}" ? "null" : propsObj; // 빈 객체는 null로
    const childrenCode = childrenNodes ? `, ${childrenNodes}` : "";
    result.push(
      // tag, props, children를 순서대로 삽입
      `h(${
        /^[a-z]/.test(tag) ? `'${tag}'` : `${tag}`
      }, ${propsCode}${childrenCode})`
    );

    lastIndex = unifiedTagRegex.lastIndex;
  }

  // trailing text
  if (lastIndex < fragment.length) {
    const trailing = fragment.slice(lastIndex).trim();
    if (trailing) result.push(JSON.stringify(trailing));
  }

  return result.join(", ");
}

/**
 * props 문자열(raw) → JS 객체 리터럴 형태 문자열로 변환
 * - 중첩 중괄호({{…}})를 균형 있게 파싱
 * - 스프레드, 표현식, 문자열, 템플릿 리터럴, bare boolean 지원
 */
function transformProps(raw) {
  raw = raw.trim();
  if (!raw) return "{}";

  const parts = [];
  let i = 0,
    len = raw.length;

  while (i < len) {
    // 1) 공백 건너뛰기
    if (/\s/.test(raw[i])) {
      i++;
      continue;
    }

    // 2) 스프레드: ...expr 또는 {...expr}
    if (raw.startsWith("...", i)) {
      i += 3;
      // {...expr} 형태
      if (raw[i] === "{") {
        let count = 1,
          start = ++i;
        while (i < len && count) {
          if (raw[i] === "{") count++;
          else if (raw[i] === "}") count--;
          i++;
        }
        parts.push(`...(${raw.slice(start, i - 1).trim()})`);
      } else {
        // ...identifier
        let start = i;
        while (i < len && /[\w$\.]/.test(raw[i])) i++;
        parts.push(`...(${raw.slice(start, i).trim()})`);
      }
      continue;
    }

    // 3) propName 파싱
    let startKey = i;
    while (i < len && /[\w$]/.test(raw[i])) i++;
    const key = raw.slice(startKey, i);

    // 공백 넘기기
    while (i < len && /\s/.test(raw[i])) i++;

    // 4) = 있으면 값 파싱, 없으면 bare boolean
    if (raw[i] === "=") {
      i++; // '=' 건너뛰기
      while (i < len && /\s/.test(raw[i])) i++;

      // 4-1) {expr} 형태
      if (raw[i] === "{") {
        let count = 1,
          startVal = ++i;
        while (i < len && count) {
          if (raw[i] === "{") count++;
          else if (raw[i] === "}") count--;
          i++;
        }
        const expr = raw.slice(startVal, i - 1).trim();
        parts.push(`${key}:(${expr})`);
      }
      // 4-2) "string" 또는 'string'
      else if (raw[i] === `"` || raw[i] === `'`) {
        const quote = raw[i++];
        let startVal = i;
        while (i < len && raw[i] !== quote) {
          if (raw[i] === "\\") i += 2;
          else i++;
        }
        const str = raw.slice(startVal, i);
        i++;
        parts.push(`${key}:"${str}"`);
      }
      // 4-3) `template ${…}` 리터럴
      else if (raw[i] === "`") {
        i++;
        let startVal = i;
        while (i < len && raw[i] !== "`") {
          if (raw[i] === "\\") i += 2;
          else i++;
        }
        const tpl = raw.slice(startVal, i);
        i++;
        parts.push(`${key}:\`${tpl}\``);
      }
      // 4-4) unquoted literal (숫자, identifier 등)
      else {
        let startVal = i;
        while (i < len && /[^\s]/.test(raw[i])) i++;
        const lit = raw.slice(startVal, i);
        parts.push(`${key}:${lit}`);
      }
    } else {
      // 5) bare boolean
      parts.push(`${key}:true`);
    }
  }

  return `{${parts.join(",")}}`;
}

/**
 * Parse simple JSX expression literal: number, boolean, null, identifier
 */
function parseJsxValue(val) {
  val = val.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(val)) return Number(val);
  if (val === "true") return true;
  if (val === "false") return false;
  if (val === "null") return null;
  // fallback: pass through as identifier or expression string
  return val;
}

// Example usage:
// const source = `
//   <div className="header">
//     Hello <b>world</b>!
//     <input disabled />
//   </div>`;
// console.log(convertJsxToH(source));
