/**
 * =================================================================
 * JSX to h() Transformer (No Dependencies) - Refactored
 * =================================================================
 *
 * This script transforms JSX syntax into standard JavaScript h() function calls.
 *
 * Key Improvements in this version:
 * - Replaced global cursor with index passing for stable parsing. Each parsing
 *   function now returns the end position of its operation.
 * - Correctly handles JSX inside JavaScript expressions (e.g., map, conditionals)
 *   by recursively calling the main transform function on the expression's content.
 * - Fixed parsing for spread attributes ({...props}).
 * - Improved code generator for clean, readable, and correctly indented output.
 * - More robust handling of text nodes and whitespace.
 */
export function transformJsx(sourceCode) {
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
      output += generateCode(node);
      cursor = end;
    } catch (e) {
      // If parsing fails, it might not be real JSX (e.g., a < b).
      // Treat as a simple character and continue scanning.
      console.warn(
        `JSX parsing failed at index ${cursor}, treating as text: ${e.message}`
      );
      output += sourceCode[cursor];
      cursor++;
    }
  }

  return output;
}

// ----------------------------------------------------------------
//                          1. PARSER
// ----------------------------------------------------------------

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
  // Fragment: <>
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

    // Spread attributes: {...item}
    if (source.startsWith("{...", cursor)) {
      cursor += 4; // Skip '{...'
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
      cursor++; // Skip '}'
      continue;
    }

    // Regular props: name={value} or name="value" or just name
    const nameStart = cursor;
    if (!/[a-zA-Z_]/.test(source[nameStart])) {
      // This can happen if we are at the end of props list.
      break;
    }
    while (cursor < source.length && /[a-zA-Z0-9_-]/.test(source[cursor])) {
      cursor++;
    }
    const name = source.slice(nameStart, cursor);
    let value = { type: "JsExpression", code: "true" }; // Default for boolean props

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
          if (source[valueEnd] === "\\") valueEnd++; // Skip escaped quotes
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

    // Closing tag
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
      cursor++; // Skip '>'
      return { children, end: cursor };
    }

    // Child element
    if (source[cursor] === "<") {
      const { node, end } = parseElement(source, cursor);
      children.push(node);
      cursor = end;
      continue;
    }

    // JS Expression
    if (source[cursor] === "{") {
      const { node, end } = parseJsExpression(source, cursor);
      children.push(node);
      cursor = end;
      continue;
    }

    // Text node
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
        // Recursively transform content inside braces
        const transformedCode = transformJsx(code);
        return {
          node: { type: "JsExpression", code: transformedCode },
          end: currentPos + 1,
        };
      }
    } else if (char === "'" || char === '"' || char === "`") {
      // Skip over strings to avoid counting braces inside them
      const quote = char;
      currentPos++;
      while (currentPos < source.length && source[currentPos] !== quote) {
        if (source[currentPos] === "\\") currentPos++; // handle escaped quotes
        currentPos++;
      }
    }
    currentPos++;
  }
  throw new Error("Unmatched braces in JSX expression.");
}

// ----------------------------------------------------------------
//                        2. CODE GENERATOR
// ----------------------------------------------------------------

function generateCode(node, indent = 0) {
  const i = (level = 0) => "  ".repeat(indent + level);

  switch (node.type) {
    case "Element": {
      // Use component name directly, wrap HTML tags in quotes. Fragments are 'null'.
      const tag = node.tagName.match(/^[a-z]/)
        ? `'${node.tagName}'`
        : node.tagName || "null";

      let propsStr = "null";
      if (node.props.length > 0) {
        const propParts = node.props.map((p) => {
          if (p.type === "Spread") {
            return `...${p.expression}`;
          }
          const propValue = generateCode(p.value, indent + 1);
          // Handle className -> class if needed, etc.
          return `${p.name}: ${propValue}`;
        });
        propsStr = `{ ${propParts.join(", ")} }`;
      }

      const children = node.children
        .map((child) => generateCode(child, indent + 1))
        .filter(Boolean); // Filter out empty strings from whitespace-only text nodes

      // Single-line format for no children
      if (children.length === 0) {
        // If props are also simple, keep it on one line
        if (propsStr.length < 50 && !propsStr.includes("\n")) {
          return `h(${tag}, ${propsStr})`;
        }
        return `h(\n${i(1)}${tag},\n${i(1)}${propsStr}\n${i()})`;
      }

      // Multi-line format for elements with children
      const childrenStr = children.join(`,\n${i(1)}`);
      return `h(\n${i(1)}${tag},\n${i(1)}${propsStr},\n${i(
        1
      )}${childrenStr}\n${i()})`;
    }
    case "JsExpression": {
      return node.code;
    }
    case "StringLiteral": {
      return JSON.stringify(node.value);
    }
    case "Text": {
      // Collapse whitespace and trim, then stringify
      const cleanedText = node.value.replace(/\s+/g, " ").trim();
      if (!cleanedText) return null; // Return null to be filtered out
      return JSON.stringify(cleanedText);
    }
    default:
      return "";
  }
}

// ----------------------------------------------------------------
//                          3. HELPERS
// ----------------------------------------------------------------

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
  let braceDepth = 0;

  for (let i = startIndex; i < source.length; i++) {
    const char = source[i];
    const nextChar = source[i + 1];

    if (inString) {
      if (char === "\\") {
        // Skip escaped char
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

    // Heuristic: A JSX tag starts with '<' followed by a letter or '/' (for closing tags).
    // It should not be preceded by characters that suggest it's a comparison operator.
    if (char === "<") {
      if (/[a-zA-Z/]/.test(nextChar)) {
        const prevChar = getPrevMeaningfulChar(source, i);
        // Avoid matching arrow functions like `() => <div...` as a comparison
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
