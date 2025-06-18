// transformer.js (통합 버전)

// =================================================================
//                 1. 설정 (Configuration)
// =================================================================
/**
 * 포맷팅 활성화 플래그.
 * true로 설정하면 변환된 코드가 읽기 좋게 정렬됩니다.
 * false로 설정하면 압축된 형태로 출력됩니다.
 * 이 값은 transformJsx 함수의 두 번째 인자로 덮어쓸 수 있습니다.
 */
let ENABLE_FORMATTING = true;

/**
 * =================================================================
 * JSX to h() Transformer (with Integrated Formatter)
 * =================================================================
 *
 * @param {string} sourceCode - 변환할 JSX가 포함된 소스 코드.
 * @param {boolean} [format=true] - 결과물을 포맷팅할지 여부.
 * @returns {string} 변환된 JavaScript 코드.
 */
export function transformJsx(sourceCode, format = ENABLE_FORMATTING) {
  console.log(format ? `Using prettify` : `Prettify disabled.`);
  ENABLE_FORMATTING = format; // 외부에서 받은 인자로 플래그 설정
  let output = "";
  let cursor = 0;

  while (cursor < sourceCode.length) {
    const nextJsxStart = findNextJsxStart(sourceCode, cursor);

    if (nextJsxStart === -1) {
      output += sourceCode.slice(cursor);
      break;
    }

    output += sourceCode.slice(cursor, nextJsxStart);

    try {
      const { node, end } = parseElement(sourceCode, nextJsxStart);
      // generateCode 함수는 이제 들여쓰기 시작 레벨을 인자로 받습니다.
      const initialIndent = getInitialIndent(output);
      output += generateCode(node, initialIndent);
      cursor = end;
    } catch (e) {
      console.warn(
        `JSX parsing failed at index ${cursor}, treating as text: ${e.message}`
      );
      output += sourceCode[cursor];
      cursor++;
    }
  }

  return output;
}

// =================================================================
//                          2. 파서 (Parser)
// =================================================================
// (이 섹션의 코드는 변경되지 않았으므로 기존 코드를 그대로 사용합니다)

function parseElement(source, index) {
  let cursor = index;

  if (source[cursor] !== "<") {
    throw new Error("Not a valid JSX element.");
  }

  const startCursor = cursor;
  cursor++; // Skip '<'

  const { name: tagName, end: tagNameEnd } = parseTagName(source, cursor);
  cursor = tagNameEnd;

  const { props, end: propsEnd } = parseProps(source, cursor);
  cursor = propsEnd;

  if (source.startsWith("/>", cursor)) {
    cursor += 2; // Skip '/>'
    return {
      node: { type: "Element", tagName, props, children: [] },
      end: cursor,
    };
  }

  if (source[cursor] !== ">") {
    throw new Error("Expected '>' at the end of the opening tag.");
  }
  cursor++; // Skip '>'

  const { children, end: childrenEnd } = parseChildren(source, cursor, tagName);
  cursor = childrenEnd;

  return {
    node: { type: "Element", tagName, props, children, startCursor },
    end: cursor,
  };
}

function parseTagName(source, index) {
  let cursor = skipWhitespace(source, index);
  if (source[cursor] === ">") {
    return { name: "", end: cursor };
  }
  const start = cursor;
  while (cursor < source.length && /[a-zA-Z0-9_.-]/.test(source[cursor])) {
    cursor++;
  }
  const name = source.slice(start, cursor);
  if (!name) {
    throw new Error("Tag name is missing.");
  }
  return { name, end: cursor };
}

function parseProps(source, index) {
  let cursor = index;
  const props = [];

  while (cursor < source.length) {
    cursor = skipWhitespaceAndComments(source, cursor);

    if (source[cursor] === ">" || source.startsWith("/>", cursor)) {
      break;
    }

    if (source.startsWith("{...", cursor)) {
      cursor += 4;
      const exprStart = cursor;
      let braceDepth = 1;
      while (cursor < source.length) {
        if (source[cursor] === "{") braceDepth++;
        if (source[cursor] === "}") braceDepth--;
        if (braceDepth === 0) break;
        cursor++;
      }
      const expression = source.slice(exprStart, cursor).trim();
      props.push({ type: "Spread", expression });
      cursor++;
      continue;
    }

    const nameStart = cursor;
    if (!/[a-zA-Z_]/.test(source[nameStart])) {
      break;
    }
    while (cursor < source.length && /[a-zA-Z0-9_-]/.test(source[cursor])) {
      cursor++;
    }
    const name = source.slice(nameStart, cursor);
    let value = { type: "JsExpression", code: "true" };

    let postNameCursor = skipWhitespace(source, cursor);
    if (source[postNameCursor] === "=") {
      cursor = skipWhitespace(source, postNameCursor + 1);

      if (source[cursor] === "{") {
        const { node, end } = parseJsExpression(source, cursor);
        value = node;
        cursor = end;
      } else if (source[cursor] === '"' || source[cursor] === "'") {
        const quote = source[cursor];
        const valueStart = cursor + 1;
        let valueEnd = valueStart;
        while (valueEnd < source.length && source[valueEnd] !== quote) {
          if (source[valueEnd] === "\\") valueEnd++;
          valueEnd++;
        }
        value = {
          type: "StringLiteral",
          value: source.slice(valueStart, valueEnd),
        };
        cursor = valueEnd + 1;
      } else {
        throw new Error(`Invalid prop value for ${name}`);
      }
    }
    props.push({ type: "Prop", name, value });
  }

  return { props, end: cursor };
}

function parseChildren(source, index, parentTag) {
  let cursor = index;
  const children = [];

  while (cursor < source.length) {
    cursor = skipWhitespaceAndComments(source, cursor);

    if (source.startsWith("</", cursor)) {
      const closingTagStart = cursor + 2;
      const { name: closingTag, end: closingTagEnd } = parseTagName(
        source,
        closingTagStart
      );
      cursor = closingTagEnd;
      cursor = skipWhitespace(source, cursor);
      if (source[cursor] !== ">") {
        throw new Error(`Expected '>' for closing tag ${closingTag}`);
      }
      if (parentTag && closingTag && parentTag !== closingTag) {
        throw new Error(
          `Mismatched closing tag. Expected </${parentTag}> but got </${closingTag}>.`
        );
      }
      cursor++;
      return { children, end: cursor };
    }

    if (source[cursor] === "<") {
      const { node, end } = parseElement(source, cursor);
      children.push(node);
      cursor = end;
      continue;
    }

    if (source[cursor] === "{") {
      const { node, end } = parseJsExpression(source, cursor);
      children.push(node);
      cursor = end;
      continue;
    }

    const textStart = cursor;
    while (
      cursor < source.length &&
      source[cursor] !== "<" &&
      source[cursor] !== "{"
    ) {
      cursor++;
    }
    const text = source.slice(textStart, cursor);
    if (text.trim()) {
      children.push({ type: "Text", value: text });
    }
  }

  if (parentTag) {
    throw new Error(`Unclosed tag: ${parentTag}. Reached end of source.`);
  }

  return { children, end: cursor };
}

function parseJsExpression(source, index) {
  if (source[index] !== "{") throw new Error("Invalid JS expression start");

  let braceDepth = 1;
  const start = index + 1;
  let currentPos = start;

  while (currentPos < source.length) {
    const char = source[currentPos];
    if (char === "{") {
      braceDepth++;
    } else if (char === "}") {
      braceDepth--;
      if (braceDepth === 0) {
        const code = source.slice(start, currentPos);
        const transformedCode = transformJsx(code);
        return {
          node: { type: "JsExpression", code: transformedCode },
          end: currentPos + 1,
        };
      }
    } else if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      currentPos++;
      while (currentPos < source.length && source[currentPos] !== quote) {
        if (source[currentPos] === "\\") currentPos++;
        currentPos++;
      }
    }
    currentPos++;
  }
  throw new Error("Unmatched braces in JSX expression.");
}

// =================================================================
//               3. 코드 생성기 (Code Generator) - 수정됨
// =================================================================

function generateCode(node, indent = 0) {
  const format = ENABLE_FORMATTING;
  const i = (level = 0) => (format ? "  ".repeat(indent + level) : "");
  const nl = format ? "\n" : "";
  const sp = format ? " " : "";

  switch (node.type) {
    case "Element": {
      const tag = node.tagName.match(/^[a-z]/)
        ? `'${node.tagName}'`
        : node.tagName || "null";

      let propsStr = "null";
      let propsAreComplex = false;
      if (node.props.length > 0) {
        const propParts = node.props.map((p) => {
          if (p.type === "Spread") {
            return `...${p.expression}`;
          }
          const propValue = generateCode(p.value, indent + 1);
          if (propValue.includes("\n")) {
            propsAreComplex = true;
          }
          return `${p.name}:${sp}${propValue}`;
        });

        const singleLineProps = `{${sp}${propParts.join(`,${sp}`)}${sp}}`;
        if (propsAreComplex || (format && singleLineProps.length > 80)) {
          propsAreComplex = true;
          propsStr = `{${nl}${i(1)}${propParts.join(
            `,${nl}${i(1)}`
          )}${nl}${i()}}`;
        } else {
          propsStr = singleLineProps;
        }
      }

      const children = node.children
        .map((child) => generateCode(child, indent + 1))
        .filter(Boolean);

      const childrenAreComplex = children.some(
        (c) => c.includes("\n") || c.startsWith("h(")
      );
      const isComplex =
        propsAreComplex || childrenAreComplex || children.length > 1;

      if (!format) {
        const childrenStr = children.length > 0 ? `,${children.join(",")}` : "";
        return `h(${tag},${propsStr}${childrenStr})`;
      }

      if (!isComplex && children.length <= 1) {
        const childrenStr = children.length > 0 ? `,${sp}${children[0]}` : "";
        return `h(${tag},${sp}${propsStr}${childrenStr})`;
      } else {
        const childrenStr = children.join(`,${nl}${i(1)}`);
        return `h(${nl}${i(1)}${tag},${nl}${i(1)}${propsStr}${
          children.length > 0 ? `,${nl}${i(1)}${childrenStr}` : ""
        }${nl}${i()})`;
      }
    }
    case "JsExpression": {
      return node.code;
    }
    case "StringLiteral": {
      return JSON.stringify(node.value);
    }
    case "Text": {
      const cleanedText = node.value.replace(/\s+/g, " ").trim();
      return cleanedText ? JSON.stringify(cleanedText) : null;
    }
    default:
      return "";
  }
}

// =================================================================
//                          4. 헬퍼 (Helpers)
// =================================================================
// (이 섹션의 코드는 변경되지 않았으므로 기존 코드를 그대로 사용합니다)

function getInitialIndent(text) {
  const lastLine = text.split("\n").pop() || "";
  const match = lastLine.match(/^\s*/);
  return match ? Math.floor(match[0].length / 2) : 0;
}

function skipWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) {
    index++;
  }
  return index;
}

function skipWhitespaceAndComments(source, index) {
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index++;
    } else if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
    } else if (source.startsWith("//", index)) {
      const end = source.indexOf("\n", index + 2);
      index = end === -1 ? source.length : end + 1;
    } else if (source.startsWith("{/*", index)) {
      const end = source.indexOf("*/}", index + 3);
      index = end === -1 ? source.length : end + 3;
    } else {
      break;
    }
  }
  return index;
}

function findNextJsxStart(source, startIndex) {
  let inString = null;
  let inComment = false;

  for (let i = startIndex; i < source.length; i++) {
    const char = source[i];
    const nextChar = source[i + 1];

    if (inString) {
      if (char === "\\") {
        i++;
        continue;
      }
      if (char === inString) inString = null;
      continue;
    }

    if (inComment) {
      if (inComment === "multi" && char === "*" && nextChar === "/") {
        inComment = false;
        i++;
      } else if (inComment === "single" && char === "\n") {
        inComment = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      continue;
    }
    if (char === "/" && nextChar === "*") {
      inComment = "multi";
      i++;
      continue;
    }
    if (char === "/" && nextChar === "/") {
      inComment = "single";
      i++;
      continue;
    }

    if (char === "<") {
      if (/[a-zA-Z/]/.test(nextChar)) {
        const prevChar = getPrevMeaningfulChar(source, i);
        if (prevChar !== "=" && prevChar !== "<" && prevChar !== ">") {
          return i;
        }
      }
    }
  }
  return -1;
}

function getPrevMeaningfulChar(source, index) {
  let i = index - 1;
  while (i >= 0) {
    if (/\S/.test(source[i])) {
      return source[i];
    }
    i--;
  }
  return null;
}
