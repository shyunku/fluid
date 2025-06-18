/**
 * =================================================================
 * JSX to h() Transformer (No Dependencies)
 * =================================================================
 *
 * This script transforms JSX syntax into standard JavaScript h() function calls.
 * It works by parsing the code character-by-character, building an
 * Abstract Syntax Tree (AST) for JSX elements, and then generating
 * JavaScript code from that AST.
 *
 * Key Features:
 * - No external libraries or dependencies.
 * - Handles nested JSX within JavaScript expressions (e.g., inside .map()).
 * - Supports components (PascalCase) and standard HTML tags (lowercase).
 * - Supports fragments (<>...</>).
 * - Handles props: string literals, expression values, boolean props, and spread attributes.
 * - Ignores JSX-style comments {/* ... * /}.
 * - Designed to be more robust than regex-based find-and-replace solutions.
 */
export function transformJsx(sourceCode) {
  let cursor = 0;
  let output = "";

  /**
   * The main loop iterates through the source code to find JSX blocks.
   * It copies non-JSX code as is and processes JSX blocks when found.
   */
  while (cursor < sourceCode.length) {
    const nextJsxStart = findNextJsxStart(sourceCode, cursor);

    if (nextJsxStart === -1) {
      // No more JSX found, append the rest of the code and exit.
      output += sourceCode.slice(cursor);
      break;
    }

    // Append the JavaScript code before the JSX block.
    output += sourceCode.slice(cursor, nextJsxStart);
    cursor = nextJsxStart;

    try {
      // Parse the found JSX block to get an AST and the end position.
      const { node, end } = parseElement(sourceCode, cursor);
      // Generate the h() function call from the AST.
      output += generateCode(node);
      cursor = end;
    } catch (e) {
      // If parsing fails, it might not be real JSX (e.g., `a < b`).
      // In that case, just append the '<' and continue scanning.
      console.warn("Parsing failed, treating as simple text:", e.message);
      output += sourceCode[cursor];
      cursor++;
    }
  }

  return output;
}

// ----------------------------------------------------------------
//                          1. PARSER
// ----------------------------------------------------------------
// Parses a string of JSX code and returns an Abstract Syntax Tree (AST).

function parseElement(source, C) {
  let cursor = C;

  const skipWhitespaceAndComments = () => {
    while (cursor < source.length) {
      if (/\s/.test(source[cursor])) {
        cursor++;
      } else if (source.startsWith("/*", cursor)) {
        const end = source.indexOf("*/", cursor + 2);
        cursor = end === -1 ? source.length : end + 2;
      } else if (source.startsWith("//", cursor)) {
        const end = source.indexOf("\n", cursor + 2);
        cursor = end === -1 ? source.length : end + 1;
      } else if (source.startsWith("{/*", cursor)) {
        const end = source.indexOf("*/}", cursor + 3);
        cursor = end === -1 ? source.length : end + 3;
      } else {
        break;
      }
    }
  };

  const parseTagName = () => {
    skipWhitespaceAndComments();
    if (source[cursor] === ">") return ""; // Fragment <>
    const start = cursor;
    while (cursor < source.length && /[a-zA-Z0-9_.-]/.test(source[cursor])) {
      cursor++;
    }
    return source.slice(start, cursor);
  };

  const parseJsExpression = () => {
    let braceDepth = 1;
    const start = cursor + 1;
    let currentPos = start;

    while (currentPos < source.length) {
      if (source[currentPos] === "{") {
        braceDepth++;
      } else if (source[currentPos] === "}") {
        braceDepth--;
        if (braceDepth === 0) {
          const code = source.slice(start, currentPos);
          cursor = currentPos + 1;
          // Recursively transform content inside braces
          return {
            type: "JsExpression",
            code: transformJsx(code),
          };
        }
      } else if (
        source[currentPos] === "'" ||
        source[currentPos] === '"' ||
        source[currentPos] === "`"
      ) {
        // Skip over strings to avoid counting braces inside them
        const quote = source[currentPos];
        currentPos++;
        while (currentPos < source.length && source[currentPos] !== quote) {
          if (source[currentPos] === "\\") currentPos++; // handle escaped quotes
          currentPos++;
        }
      }
      currentPos++;
    }
    throw new Error("Unmatched braces in JSX expression.");
  };

  const parseProps = () => {
    const props = [];
    skipWhitespaceAndComments();
    while (
      cursor < source.length &&
      source[cursor] !== ">" &&
      !source.startsWith("/>", cursor)
    ) {
      if (source[cursor] === "{" && source.startsWith("{...", cursor)) {
        cursor += 4; // Skip '{...'
        const expr = parseJsExpression();
        props.push({ type: "Spread", expression: expr.code });
        // After parsing a spread expression, it returns control, so we need to adjust cursor
        // but parseJsExpression already moved the cursor past the '}'
        cursor--; // Go back one char before the last '}'
        while (source[cursor] !== "}") cursor++;
        cursor++;
      } else {
        const nameStart = cursor;
        if (!/[a-zA-Z_]/.test(source[nameStart])) break;

        while (cursor < source.length && /[a-zA-Z0-9_-]/.test(source[cursor])) {
          cursor++;
        }
        const name = source.slice(nameStart, cursor);
        let value = { type: "JsExpression", code: "true" }; // Default for boolean props

        skipWhitespaceAndComments();

        if (source[cursor] === "=") {
          cursor++; // Skip '='
          skipWhitespaceAndComments();
          if (source[cursor] === "{") {
            value = parseJsExpression();
          } else {
            const quote = source[cursor];
            const valueStart = cursor;
            if (quote === '"' || quote === "'") {
              cursor++;
              let valueEnd = cursor;
              while (valueEnd < source.length && source[valueEnd] !== quote) {
                if (source[valueEnd] === "\\") valueEnd++;
                valueEnd++;
              }
              cursor = valueEnd + 1;
              value = {
                type: "StringLiteral",
                value: source.slice(valueStart, cursor),
              };
            }
          }
        }
        props.push({ type: "Prop", name, value });
      }
      skipWhitespaceAndComments();
    }
    return props;
  };

  const parseChildren = (parentTag) => {
    const children = [];
    while (cursor < source.length) {
      skipWhitespaceAndComments();
      if (source.startsWith("</", cursor)) {
        break;
      }
      if (source[cursor] === "<") {
        children.push(parseElement(source, cursor).node);
        // The cursor is updated globally within the recursive parseElement call.
        // We need to re-sync it here. This is a bit tricky.
        // A better way is for parseElement to return its end cursor.
        // The current implementation relies on a "global" cursor, which works but is less clean.
        // Re-parsing to get end cursor
        const { end } = parseElement(
          source,
          children[children.length - 1].startCursor
        );
        cursor = end;
      } else if (source[cursor] === "{") {
        children.push(parseJsExpression());
      } else {
        const textStart = cursor;
        while (
          cursor < source.length &&
          source[cursor] !== "<" &&
          source[cursor] !== "{"
        ) {
          cursor++;
        }
        const text = source.slice(textStart, cursor).trim();
        if (text) {
          children.push({ type: "Text", value: text });
        }
      }
    }
    return children;
  };

  // --- Start of parseElement execution ---
  if (source[cursor] !== "<") throw new Error("Not a valid JSX element.");
  const startCursor = cursor;
  cursor++; // consume '<'

  const tagName = parseTagName();
  const props = parseProps();

  skipWhitespaceAndComments();

  if (source.startsWith("/>", cursor)) {
    cursor += 2; // consume '/>'
    return {
      node: { type: "Element", tagName, props, children: [], startCursor },
      end: cursor,
    };
  }

  if (source[cursor] !== ">") throw new Error("Expected '>' at end of tag.");
  cursor++; // consume '>'

  const children = parseChildren(tagName);

  // Parse closing tag
  skipWhitespaceAndComments();
  if (!source.startsWith("</", cursor))
    throw new Error(`Expected closing tag for ${tagName}`);
  cursor += 2; // consume '</'
  const closingTag = parseTagName();
  if (tagName && closingTag && tagName !== closingTag) {
    throw new Error(
      `Mismatched closing tag. Expected ${tagName} but got ${closingTag}.`
    );
  }
  skipWhitespaceAndComments();
  if (source[cursor] !== ">") throw new Error("Expected '>' for closing tag.");
  cursor++; // consume '>'

  return {
    node: { type: "Element", tagName, props, children, startCursor },
    end: cursor,
  };
}

// ----------------------------------------------------------------
//                        2. CODE GENERATOR
// ----------------------------------------------------------------
// Traverses the AST and generates the final `h()` function call string.

function generateCode(node, indent = 0) {
  if (!node) return "null";
  const i = (level = 0) => "  ".repeat(indent + level);

  switch (node.type) {
    case "Element": {
      const tag = node.tagName.match(/^[a-z]/)
        ? `'${node.tagName}'`
        : node.tagName || "null";
      let propsStr = "null";
      if (node.props.length > 0) {
        console.log(node.props);
        const propParts = node.props.map((p) => {
          if (p.type === "Spread") {
            return `...${p.expression}`;
          }
          return `${p.name}: ${generateCode(p.value, indent + 1)}`;
        });
        propsStr = `{\n${i(1)}${propParts.join(`,\n${i(1)}`)}\n${i()}}`;
      }

      if (node.children.length === 0) {
        return `h(${tag}, ${propsStr})`;
      }

      const childrenStr = node.children
        .map((child) => generateCode(child, indent + 1))
        .filter(Boolean) // Filter out empty text nodes
        .join(`,\n${i(1)}`);

      return `h(\n${i(1)}${tag},\n${i(1)}${propsStr},\n${i(
        1
      )}${childrenStr}\n${i()})`;
    }
    case "JsExpression": {
      return node.code;
    }
    case "StringLiteral": {
      return node.value;
    }
    case "Text": {
      // Trim and ignore if it's just whitespace
      const trimmed = node.value.trim();
      if (!trimmed) return "";
      // Escape backticks and wrap in quotes.
      return JSON.stringify(trimmed);
    }
    default:
      return "";
  }
}

// ----------------------------------------------------------------
//                          3. HELPERS
// ----------------------------------------------------------------

/**
 * Finds the starting position of the next potential JSX block.
 * A '<' is considered a potential start if it's not part of a string,
 * comment, or a less-than comparison. This is a heuristic.
 */
function findNextJsxStart(source, startIndex) {
  for (let i = startIndex; i < source.length; i++) {
    const char = source[i];

    // Skip over strings
    if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i++; // handle escaped quotes
        i++;
      }
      continue;
    }

    // Skip over comments
    if (char === "/" && source[i + 1] === "/") {
      i = source.indexOf("\n", i);
      if (i === -1) return -1;
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      i = source.indexOf("*/", i);
      if (i === -1) return -1;
      i++;
      continue;
    }

    // Potential JSX start found
    if (char === "<") {
      const nextChar = source[i + 1];
      // Heuristic: Must be followed by a letter, a '>', or a '/'
      if (/[a-zA-Z/>]/.test(nextChar)) {
        // Avoid matching things like '=> <div...'
        const prevMeaningfulChar = getPrevMeaningfulChar(source, i);
        if (prevMeaningfulChar !== "=") {
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

// Example usage:
// const transformed = transformJsx(inputCode);
// console.log(transformed);
