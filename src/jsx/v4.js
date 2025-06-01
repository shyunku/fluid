/**
 * Runtime JSX → h() transformer using vanilla JavaScript
 * Implements: tokenizer → recursive-descent parser → AST → code generator
 * (patched: whitespace 보존 & 잘못 합쳐진 태그‑속성 분리)
 */
(function () {
  const SYM = {
    LT: "<",
    LT_SLASH: "</",
    GT: ">",
    SLASH_GT: "/>",
    EQUALS: "=",
    ELLIPSIS: "...",
  };

  // AST node constructors
  class Program {
    constructor(children) {
      this.type = "Program";
      this.children = children;
    }
  }
  class Element {
    constructor(tag, props, children) {
      this.type = "Element";
      this.tag = tag;
      this.props = props;
      this.children = children;
    }
  }
  class TextNode {
    constructor(value) {
      this.type = "Text";
      this.value = value;
    }
  }
  class ExprNode {
    constructor(code) {
      this.type = "Expression";
      this.code = code;
    }
  }
  class SpreadNode {
    constructor(expr) {
      this.type = "Spread";
      this.expr = expr;
    }
  }
  class PropNode {
    constructor(key, value) {
      this.type = "Prop";
      this.key = key;
      this.value = value;
    }
  }

  // --- Tokenizer ---
  function tokenize(input) {
    const tokens = [];
    let i = 0,
      len = input.length;
    while (i < len) {
      const ch = input[i];
      // 숫자 리터럴
      if (/\d/.test(ch)) {
        let j = i;
        while (j < len && /[\d.]/.test(input[j])) j++;
        tokens.push({ type: "NUMBER", value: input.slice(i, j) });
        i = j;
      }
      // ★ true / false / null
      else if (/^(true|false|null)\b/.test(input.slice(i))) {
        const kw = RegExp.$1;
        tokens.push({ type: "KEYWORD", value: kw });
        i += kw.length;
      }
      // Spread "..." (LBRACE 내에서도 잡히도록 위치는 그대로)
      else if (input.startsWith("...", i)) {
        tokens.push({ type: "ELLIPSIS", value: "..." });
        i += 3;
      }
      // Tag open "<" or "</"
      else if (ch === "<" && input[i + 1] === "/") {
        tokens.push({ type: "LT_SLASH", value: SYM.LT_SLASH });
        i += 2;
      } else if (ch === "<") {
        tokens.push({ type: "LT", value: SYM.LT });
        i++;
      }
      // Self-close "/>"
      else if (ch === "/" && input[i + 1] === ">") {
        tokens.push({ type: "SLASH_GT", value: SYM.SLASH_GT });
        i += 2;
      }
      // Tag close ">"
      else if (ch === ">") {
        tokens.push({ type: "GT", value: SYM.GT });
        i++;
      }
      // Equals "="
      else if (ch === "=") {
        tokens.push({ type: "EQUALS", value: SYM.EQUALS });
        i++;
      }
      // Braces
      else if (ch === "{") {
        tokens.push({ type: "LBRACE" });
        i++;
      } else if (ch === "}") {
        tokens.push({ type: "RBRACE" });
        i++;
      }
      // String literal "…" or '…'
      else if (ch === '"' || ch === "'") {
        const quote = ch;
        let j = i + 1;
        while (j < len && input[j] !== quote) {
          if (input[j] === "\\") j += 2;
          else j++;
        }
        tokens.push({ type: "STRING", value: input.slice(i, j + 1) });
        i = j + 1;
      }
      // Template literal `…`
      else if (ch === "`") {
        let j = i + 1;
        while (j < len && input[j] !== "`") {
          if (input[j] === "\\") j += 2;
          else j++;
        }
        tokens.push({ type: "TEMPLATE", value: input.slice(i, j + 1) });
        i = j + 1;
      }
      // Identifier (tag or prop name)
      else if (/[A-Za-z_$]/.test(ch)) {
        let j = i;
        while (j < len && /[\w$]/.test(input[j])) j++;
        tokens.push({ type: "IDENT", value: input.slice(i, j) });
        i = j;
      }
      // Whitespace → 보존 (TextNode 용)
      else if (/\s/.test(ch)) {
        let j = i;
        while (j < len && /\s/.test(input[j])) j++;
        tokens.push({ type: "WS", value: input.slice(i, j) });
        i = j;
      }
      // Text node content (기타 문자)
      else {
        let j = i;
        while (j < len && !["<", "{", "}", "`", ">", "/"].includes(input[j]))
          j++;
        // ★ 문자를 하나도 읽지 못하면(예: '/') 포인터만 앞으로 옮기고 건너뜀 → 무한 루프 방지
        if (j === i) {
          i++; // skip single char
          continue;
        }
        tokens.push({ type: "TEXT", value: input.slice(i, j) });
        i = j;
      }
    }
    tokens.push({ type: "EOF" });
    return tokens;
  }

  // --- Parser ---
  function parse(input) {
    const tokens = tokenize(input);
    let pos = 0;

    function peek() {
      return tokens[pos];
    }
    function consume(type) {
      const t = tokens[pos];
      if (type && t.type !== type) {
        throw new Error(`Expected ${type}, got ${t.type}`);
      }
      pos++;
      return t;
    }

    // 연속 텍스트(WS 포함) 병합 & 공백 보존
    function collectText() {
      let txt = "";
      while (
        ["TEXT", "IDENT", "NUMBER", "KEYWORD", "WS"].includes(peek().type)
      ) {
        const t = consume();
        txt += t.value;
      }
      return new TextNode(txt);
    }

    function parseNodes(stopTypes) {
      const nodes = [];
      while (!stopTypes.includes(peek().type) && peek().type !== "EOF") {
        const node = parseNode();
        if (node) nodes.push(node);
        else consume(); // 안전하게 포인터 전진
      }
      return nodes;
    }

    function parseNode() {
      const t = peek();
      if (t.type === "LT") return parseElement();
      if (["TEXT", "IDENT", "NUMBER", "KEYWORD", "WS"].includes(t.type))
        return collectText();
      if (t.type === "LBRACE") return parseExpression();
      return null;
    }

    function parseExpression() {
      consume("LBRACE"); // '{'
      let depth = 1,
        code = "";
      while (peek().type !== "EOF") {
        const t = consume();
        if (t.type === "LBRACE") {
          depth++;
          code += "{";
        } else if (t.type === "RBRACE") {
          depth--;
          if (depth === 0) break;
          code += "}";
        } else {
          code += t.value ?? "";
        }
      }
      return new ExprNode(code.trim());
    }

    function parseElement() {
      consume("LT"); // '<'
      let tagToken = consume("IDENT").value;

      // ★ 태그와 속성이 붙어버린 경우(auto‑fix): buttononClick → tag=button, push onClick IDENT
      const m = tagToken.match(/^([a-z]+)([A-Z].*)$/);
      if (m) {
        tagToken = m[1];
        tokens.splice(pos, 0, { type: "IDENT", value: m[2] }); // 속성 IDENT 앞으로 삽입
      }
      const tag = tagToken;

      const props = [];
      while (!["GT", "SLASH_GT", "EOF"].includes(peek().type)) {
        // 스프레드 {...obj}
        if (peek().type === "LBRACE" && tokens[pos + 1]?.type === "ELLIPSIS") {
          consume("LBRACE");
          consume("ELLIPSIS");
          let code = "",
            depth = 0;
          while (peek().type !== "RBRACE" || depth) {
            const t = consume();
            if (t.type === "LBRACE") {
              depth++;
              code += "{";
            } else if (t.type === "RBRACE") {
              depth--;
              code += "}";
            } else code += t.value ?? "";
          }
          consume("RBRACE");
          props.push(new SpreadNode(new ExprNode(code.trim())));
          continue;
        }
        // 일반 속성 key[=value]
        if (peek().type === "IDENT") {
          const key = consume("IDENT").value;
          let value = new ExprNode("true");
          if (peek().type === "EQUALS") {
            consume("EQUALS");
            if (peek().type === "LBRACE") value = parseExpression();
            else if (peek().type === "STRING")
              value = new ExprNode(consume("STRING").value);
            else if (peek().type === "TEMPLATE")
              value = new ExprNode(consume("TEMPLATE").value);
            else if (peek().type === "NUMBER")
              value = new ExprNode(consume("NUMBER").value);
            else if (peek().type === "KEYWORD")
              value = new ExprNode(consume("KEYWORD").value);
          }
          props.push(new PropNode(key, value));
          continue;
        }
        consume(); // 예상 외 토큰 skip
      }

      if (peek().type === "SLASH_GT") {
        consume("SLASH_GT");
        return new Element(tag, props, []);
      }
      if (peek().type === "GT") consume("GT");

      const children = parseNodes(["LT_SLASH", "EOF"]);

      if (peek().type === "LT_SLASH") {
        consume("LT_SLASH");
        if (peek().type === "IDENT") consume("IDENT");
        if (peek().type === "GT") consume("GT");
      }
      return new Element(tag, props, children);
    }

    return new Program(parseNodes(["EOF"]));
  }

  // --- Code Generator ---
  function generate(node) {
    switch (node.type) {
      case "Program":
        return node.children.map(generate).filter(Boolean).join("\n");
      case "Element": {
        const tagCode = /^[a-z]/.test(node.tag) ? `'${node.tag}'` : node.tag;
        const parts = node.props.map((p) =>
          p.type === "Spread"
            ? `...${generate(p.expr)}`
            : `${p.key}:${generate(p.value)}`
        );
        const propsCode = parts.length ? `{${parts.join(",")}}` : "null";
        const children = node.children.map(generate).filter(Boolean);
        const childrenCode = children.length ? ", " + children.join(", ") : "";
        return `h(${tagCode}, ${propsCode}${childrenCode})`;
      }
      case "Text":
        return /[^\s]/.test(node.value) ? JSON.stringify(node.value) : "";
      case "Expression": {
        const src = node.code;
        // JSX가 괄호 안에 인라인으로 포함된 경우를 재귀 변환
        let out = "",
          pos = 0;
        while (true) {
          const open = src.indexOf("(", pos);
          if (open === -1) {
            out += src.slice(pos);
            break;
          }
          // '(' 뒤 첫 non‑ws 문자가 '<' 인지 확인
          let j = open + 1;
          while (j < src.length && /\s/.test(src[j])) j++;
          if (src[j] !== "<") {
            out += src.slice(pos, open + 1);
            pos = open + 1;
            continue;
          }
          // 균형 잡힌 괄호 내용 추출
          let inner, endIdx;
          try {
            ({ code: inner, endIdx } = extractBalanced(src, open));
          } catch {
            // 불균형 → 그대로 출력하고 종료
            out += src.slice(pos);
            break;
          }
          // JSX → h() 변환 시도
          let converted = inner;
          try {
            converted = generate(parse(inner));
          } catch {
            /* noop – 파싱 실패 시 원본 유지 */
          }
          out += src.slice(pos, open) + "(" + converted + ")";
          pos = endIdx + 1;
        }
        return out;
      }
    }
    return "";
  }

  function extractBalanced(str, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < str.length; i++) {
      if (str[i] === "(") depth++;
      else if (str[i] === ")" && --depth === 0)
        return { code: str.slice(openIdx + 1, i), endIdx: i };
    }
    throw new Error("Unbalanced parentheses");
  }

  // --- Transformer ---
  document
    .querySelectorAll('script[type="text/jsx"]')
    .forEach(async (script) => {
      const source = script.src
        ? await (await fetch(script.src)).text()
        : script.textContent;

      const pattern = /return\s*\(/g;
      let match,
        offset = 0,
        out = "";

      while ((match = pattern.exec(source))) {
        const start = match.index + match[0].length - 1;
        const { code: jsx, endIdx } = extractBalanced(source, start);
        const gen = generate(parse(jsx));
        out += source.slice(offset, start) + gen;
        let nextPos = endIdx + 1;
        if (source[nextPos] === ";") nextPos += 1;
        offset = nextPos;
      }
      const finalSrc = out + source.slice(offset);
      const blob = new Blob([finalSrc], { type: "text/javascript" });
      const tag = document.createElement("script");
      tag.type = "module";
      tag.src = URL.createObjectURL(blob);
      document.head.appendChild(tag);
    });
})();
