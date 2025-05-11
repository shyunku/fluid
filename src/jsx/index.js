/**
 * Runtime JSX → h() transformer using vanilla JavaScript
 * Implements: tokenizer → recursive-descent parser → AST → code generator
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
      // Whitespace
      else if (/\s/.test(ch)) {
        i++;
      }
      // Text node content
      else {
        let j = i;
        while (j < len && !["<", "{", "}", "`", ">", "/"].includes(input[j]))
          j++;

        if (j === i) {
          // 첫 글자가 곧바로 중단 문자 → 스텝 1만 이동
          i++; // 포인터를 확실히 전진시킴
          continue; // TEXT 토큰은 만들지 않음
        }

        tokens.push({ type: "TEXT", value: input.slice(i, j) });
        i = j; // 정상적으로 토큰화했을 때만 j로 이동
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

    function parseNodes(stopTypes) {
      const nodes = [];
      while (!stopTypes.includes(peek().type) && peek().type !== "EOF") {
        const node = parseNode();
        if (node) {
          nodes.push(node);
        } else {
          // ← 여기서 아무 토큰도 소비하지 않아서 무한루프 발생
          // 수정: 알 수 없는 토큰은 그냥 consume() 하여 포인터를 앞으로 옮깁니다.
          const t = consume();
          // 필요하면 비-JSX 코드를 보존하기 위해 TextNode로 만들 수도 있습니다:
          // nodes.push(new TextNode(t.value || ''));
        }
      }
      return nodes;
    }

    function parseNode() {
      const t = peek();
      if (t.type === "LT") return parseElement();
      if (t.type === "TEXT") {
        consume("TEXT");
        return new TextNode(t.value);
      }
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
          if (depth === 0) break; // 중괄호 짝 맞추면 종료
          code += "}";
        } else {
          code += t.value; // 모든 토큰은 value 보유
        }
      }
      return new ExprNode(code.trim());
    }

    function parseElement() {
      consume("LT"); // '<'
      const tag = consume("IDENT").value; // 태그 이름
      const props = [];

      // ── 1) 속성 목록 ─────────────────────────────────────
      while (!["GT", "SLASH_GT", "EOF"].includes(peek().type)) {
        // 스프레드 {...obj}
        if (peek().type === "LBRACE" && tokens[pos + 1]?.type === "ELLIPSIS") {
          consume("LBRACE"); // {
          consume("ELLIPSIS"); // ...

          // '...obj' 의 'obj' 부분만 수집
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
            } else {
              code += t.value;
            }
          }
          consume("RBRACE"); // }

          props.push(new SpreadNode(new ExprNode(code.trim())));
          continue; // 다음 속성
        }

        // 일반 속성 key[=value]
        if (peek().type === "IDENT") {
          const key = consume("IDENT").value;
          let value = new ExprNode("true"); // 값 생략 → true

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

        // 예상치 못한 토큰은 건너뜀
        consume();
      }

      // ── 2) 셀프-클로징 ──────────────────────────────────
      if (peek().type === "SLASH_GT") {
        consume("SLASH_GT");
        return new Element(tag, props, []);
      }

      // ── 3) '>' ─────────────────────────────────────────
      if (peek().type === "GT") consume("GT");

      // ── 4) 자식 노드 ───────────────────────────────────
      const children = parseNodes(["LT_SLASH", "EOF"]);

      // ── 5) 닫는 태그 소비 ──────────────────────────────
      if (peek().type === "LT_SLASH") {
        consume("LT_SLASH");
        if (peek().type === "IDENT") consume("IDENT");
        if (peek().type === "GT") consume("GT");
      }

      return new Element(tag, props, children);
    }

    const rootChildren = parseNodes(["EOF"]);
    return new Program(rootChildren);
  }

  // --- Code Generator ---
  function generate(node) {
    switch (node.type) {
      case "Program":
        return node.children.map(generate).join("\n");
      case "Element": {
        // 호스트(소문자 시작)면 문자열, 컴포넌트(대문자 시작)면 그대로 식별자
        const tagCode = /^[a-z]/.test(node.tag) ? `'${node.tag}'` : node.tag;

        // props
        const parts = node.props.map(
          (p) =>
            p.type === "Spread"
              ? `...${generate(p.expr)}` // 스프레드: ...obj
              : `${p.key}:${generate(p.value)}` // 일반 prop
        );
        const propsCode = parts.length ? `{${parts.join(",")}}` : "null";

        // children
        const children = node.children.map(generate).filter(Boolean);
        const childrenCode = children.length ? ", " + children.join(", ") : "";

        return `h(${tagCode}, ${propsCode}${childrenCode})`;
      }
      case "Text": {
        return JSON.stringify(node.value);
      }
      case "Expression": {
        const src = node.code; // trim() 제거 – 개행/들여쓰기 보존
        let out = "",
          pos = 0;

        while (true) {
          const open = src.indexOf("(", pos);
          if (open === -1) {
            // 더는 '(' 없음
            out += src.slice(pos);
            break;
          }

          // '(' 뒤 공백/개행 스킵
          let j = open + 1;
          while (j < src.length && /\s/.test(src[j])) j++;
          if (src[j] !== "<") {
            // JSX 아님
            out += src.slice(pos, open + 1);
            pos = open + 1;
            continue;
          }

          // JSX 코드와 닫는 ')' 위치 추출
          const { code: inner, endIdx } = extractBalanced(src, open);

          // JSX → h() 변환
          let converted;
          try {
            converted = generate(parse(inner));
          } catch {
            // 파싱 실패 → 원본 유지
            out += src.slice(pos, open + 1);
            pos = open + 1;
            continue;
          }

          // 앞부분 + ‘(변환본)’ 삽입
          out += src.slice(pos, open) + "(" + converted + ")";
          pos = endIdx + 1; // 닫는 ')' 뒤로 이동
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
        return { code: str.slice(openIdx + 1, i), endIdx: i }; // i = ')' 위치
    }
    throw new Error("Unbalanced parentheses");
  }

  // --- Transformer: find <script type="text/jsx"> and inject modules ---
  document
    .querySelectorAll('script[type="text/jsx"]')
    .forEach(async (script) => {
      const source = script.src
        ? await (await fetch(script.src)).text()
        : script.textContent;

      const pattern = /return\s*\(/g; // 'return ('
      let match,
        offset = 0,
        out = "";

      while ((match = pattern.exec(source))) {
        const start = match.index + match[0].length - 1; // '(' 위치
        const { code: jsx, endIdx } = extractBalanced(source, start);
        const gen = generate(parse(jsx));

        out += source.slice(offset, start) + gen;

        let nextPos = endIdx + 1;
        if (source[nextPos] === ";") nextPos += 1;
        offset = nextPos; // 다음 루프 시작점
      }
      const finalSrc = out + source.slice(offset);
      const blob = new Blob([finalSrc], {
        type: "text/javascript",
      });
      const tag = document.createElement("script");
      tag.type = "module";
      tag.src = URL.createObjectURL(blob);
      document.head.appendChild(tag);
    });
})();
