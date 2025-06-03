export function prettify(code, indentWidth = 2) {
  /*──── helpers ────*/
  const pad = (n) => " ".repeat(indentWidth * n);

  /*──── cursor state ────*/
  let out = "";
  let quote = null;
  let paren = 0; // global () depth
  let brace = 0; // {}   depth (ignore commas / parens inside objects)
  let skipWS = false; // drop original whitespace right after we emit our own break

  /** h( call stack */
  const hStack = [];

  /*──── main loop ────*/
  for (let i = 0; i < code.length; i++) {
    let ch = code[i];

    /* 1 ▸ eat original whitespace when flagged */
    if (skipWS) {
      if (/\s/.test(ch)) continue;
      skipWS = false;
    }

    /* 2 ▸ string / template literals */
    if (quote) {
      out += ch;
      if (ch === quote && code[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }

    /* 3 ▸ detect h( */
    if (code.startsWith("h(", i)) {
      out += "h(";
      i += 1; // step over the "("
      paren++;
      hStack.push({ depth: paren, argIdx: 0 });
      continue;
    }

    /* 4 ▸ braces */
    if (ch === "{") {
      brace++;
      out += ch;
      continue;
    }
    if (ch === "}") {
      brace--;
      out += ch;
      continue;
    }

    /* 5 ▸ comma outside braces = argument sep */
    if (
      ch === "," &&
      brace === 0 &&
      hStack.length &&
      paren === hStack[hStack.length - 1].depth
    ) {
      const frame = hStack[hStack.length - 1];
      frame.argIdx++;

      if (frame.argIdx === 1) {
        // between tag & props
        out += ", ";
      } else {
        // first child or next sibling
        out += ",\n" + pad(hStack.length + 1);
        skipWS = true;
      }
      continue;
    }

    /* 6 ▸ open paren (non‑h) */
    if (ch === "(") {
      paren++;
      out += ch;
      continue;
    }

    /* 7 ▸ close paren */
    if (ch === ")") {
      if (hStack.length && paren === hStack[hStack.length - 1].depth) {
        const frame = hStack[hStack.length - 1]; // ★ 현재 h( 콜의 상태
        if (frame.argIdx > 1) {
          // ★ 자식이 하나 이상이면 줄바꿈
          out += "\n" + pad(hStack.length) + ")";
        } else {
          // ★ 자식이 없으면 같은 줄에 닫음
          out += ")";
        }
        hStack.pop();
        skipWS = true;
        paren--; // after writing )
        continue;
      }
      paren--;
      out += ")";
      continue;
    }

    /* 8 ▸ default */
    out += ch;
  }

  return out.trim();
}
