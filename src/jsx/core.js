/**
 * Runtime JSX → h() transformer using vanilla JavaScript
 * Implements: tokenizer → recursive-descent parser → AST → code generator
 */
(function () {
  /*──────────────────── Helpers & AST ────────────────────*/
  const SYM = {
    LT: "<",
    LT_SLASH: "</",
    GT: ">",
    SLASH_GT: "/>",
    EQUALS: "=",
    ELLIPSIS: "...",
  };
  class Program {
    constructor(c) {
      this.type = "Program";
      this.children = c;
    }
  }
  class Element {
    constructor(t, p, c) {
      this.type = "Element";
      this.tag = t;
      this.props = p;
      this.children = c;
    }
  }
  class TextNode {
    constructor(v) {
      this.type = "Text";
      this.value = v;
    }
  }
  class ExprNode {
    constructor(c) {
      this.type = "Expression";
      this.code = c;
    }
  }
  class SpreadNode {
    constructor(e) {
      this.type = "Spread";
      this.expr = e;
    }
  }
  class PropNode {
    constructor(k, v) {
      this.type = "Prop";
      this.key = k;
      this.value = v;
    }
  }

  /*────────────────────── Tokenizer ──────────────────────*/
  function tokenize(src) {
    const tks = [];
    let i = 0,
      n = src.length;
    while (i < n) {
      const ch = src[i];
      if (/\d/.test(ch)) {
        let j = i;
        while (j < n && /[\d.]/.test(src[j])) j++;
        tks.push({ type: "NUMBER", value: src.slice(i, j) });
        i = j;
        continue;
      }
      if (/^(true|false|null)\b/.test(src.slice(i))) {
        const kw = RegExp.$1;
        tks.push({ type: "KEYWORD", value: kw });
        i += kw.length;
        continue;
      }
      if (src.startsWith("...", i)) {
        tks.push({ type: "ELLIPSIS", value: "..." });
        i += 3;
        continue;
      }
      if (ch === "<" && src[i + 1] === "/") {
        tks.push({ type: "LT_SLASH", value: SYM.LT_SLASH });
        i += 2;
        continue;
      }
      if (ch === "<") {
        tks.push({ type: "LT", value: "<" });
        i++;
        continue;
      }
      if (ch === "/" && src[i + 1] === ">") {
        tks.push({ type: "SLASH_GT", value: "/>" });
        i += 2;
        continue;
      }
      if (ch === ">") {
        tks.push({ type: "GT", value: ">" });
        i++;
        continue;
      }
      if (ch === "=") {
        tks.push({ type: "EQUALS", value: "=" });
        i++;
        continue;
      }
      if (ch === "{") {
        tks.push({ type: "LBRACE" });
        i++;
        continue;
      }
      if (ch === "}") {
        tks.push({ type: "RBRACE" });
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const q = ch;
        let j = i + 1;
        while (j < n && src[j] !== q) {
          if (src[j] === "\\") j += 2;
          else j++;
        }
        tks.push({ type: "STRING", value: src.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      if (ch === "`") {
        let j = i + 1;
        while (j < n && src[j] !== "`") {
          if (src[j] === "\\") j += 2;
          else j++;
        }
        tks.push({ type: "TEMPLATE", value: src.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      if (/[A-Za-z_$]/.test(ch)) {
        let j = i;
        while (j < n && /[\w$]/.test(src[j])) j++;
        tks.push({ type: "IDENT", value: src.slice(i, j) });
        i = j;
        continue;
      }
      if (/\s/.test(ch)) {
        let j = i;
        while (j < n && /\s/.test(src[j])) j++;
        tks.push({ type: "WS", value: src.slice(i, j) });
        i = j;
        continue;
      }
      let j = i;
      while (
        j < n &&
        !["<", "{", "}", "`", ">"].includes(src[j]) &&
        !(src[j] === "/" && src[j + 1] === ">")
      )
        j++;
      if (j === i) {
        i++;
        continue;
      }
      tks.push({ type: "TEXT", value: src.slice(i, j) });
      i = j;
    }
    tks.push({ type: "EOF" });
    return tks;
  }

  /*──────────────────────── Parser ───────────────────────*/
  function parse(code) {
    const tk = tokenize(code);
    let p = 0;
    const peek = () => tk[p];
    const eat = (t) => {
      const cur = tk[p];
      if (t && cur.type !== t) throw Error();
      p++;
      return cur;
    };
    const collect = () => {
      let v = "";
      while (["TEXT", "IDENT", "NUMBER", "KEYWORD", "WS"].includes(peek().type))
        v += eat().value;
      return new TextNode(v);
    };
    const list = (stop) => {
      const arr = [];
      while (!stop.includes(peek().type) && peek().type !== "EOF") {
        const n = unit();
        n ? arr.push(n) : eat();
      }
      return arr;
    };
    function unit() {
      const t = peek();
      if (t.type === "LT") return element();
      if (["TEXT", "IDENT", "NUMBER", "KEYWORD", "WS"].includes(t.type))
        return collect();
      if (t.type === "LBRACE") return expr();
      return null;
    }
    function expr() {
      eat("LBRACE");
      let d = 1,
        c = "";
      while (peek().type !== "EOF") {
        const t = eat();
        if (t.type === "LBRACE") {
          d++;
          c += "{";
        } else if (t.type === "RBRACE") {
          if (--d === 0) break;
          c += "}";
        } else c += t.value ?? "";
      }
      return new ExprNode(c.trim());
    }
    function element() {
      eat("LT");
      let tag = eat("IDENT").value;
      const m = tag.match(/^([a-z]+)([A-Z].*)$/);
      if (m) {
        tag = m[1];
        tk.splice(p, 0, { type: "IDENT", value: m[2] });
      }
      const props = [];
      while (!["GT", "SLASH_GT", "EOF"].includes(peek().type)) {
        if (peek().type === "LBRACE" && tk[p + 1]?.type === "ELLIPSIS") {
          eat("LBRACE");
          eat("ELLIPSIS");
          let code = "",
            dep = 0;
          while (peek().type !== "RBRACE" || dep) {
            const t = eat();
            if (t.type === "LBRACE") {
              dep++;
              code += "{";
            } else if (t.type === "RBRACE") {
              dep--;
              code += "}";
            } else code += t.value ?? "";
          }
          eat("RBRACE");
          props.push(new SpreadNode(new ExprNode(code.trim())));
          continue;
        }
        if (peek().type === "IDENT") {
          const k = eat("IDENT").value;
          let v = new ExprNode("true");
          if (peek().type === "EQUALS") {
            eat("EQUALS");
            if (peek().type === "LBRACE") v = expr();
            else if (
              ["STRING", "TEMPLATE", "NUMBER", "KEYWORD"].includes(peek().type)
            )
              v = new ExprNode(eat().value);
          }
          props.push(new PropNode(k, v));
          continue;
        }
        eat();
      }
      if (peek().type === "SLASH_GT") {
        eat("SLASH_GT");
        return new Element(tag, props, []);
      }
      if (peek().type === "GT") eat("GT");
      const kids = list(["LT_SLASH", "EOF"]);
      if (peek().type === "LT_SLASH") {
        eat("LT_SLASH");
        if (peek().type === "IDENT") eat("IDENT");
        if (peek().type === "GT") eat("GT");
      }
      return new Element(tag, props, kids);
    }
    return new Program(list(["EOF"]));
  }

  /*──────────────────── Code Generator ───────────────────*/
  function gen(node) {
    switch (node.type) {
      case "Program":
        return node.children.map(gen).filter(Boolean).join("\n");
      case "Element": {
        const tag = /^[a-z]/.test(node.tag) ? `'${node.tag}'` : node.tag;
        const pc = node.props
          .map((p) =>
            p.type === "Spread"
              ? `...${gen(p.expr)}`
              : `${p.key}:${gen(p.value)}`
          )
          .join(",");
        const kids = node.children.map(gen).filter(Boolean).join(", ");
        return `h(${tag}, ${pc ? `{${pc}}` : "null"}${
          kids ? `, ${kids}` : ""
        })`;
      }
      case "Text": {
        if (!/[^\s]/.test(node.value)) return "";
        const txt = node.value.replace(/\s+/g, " ").trim();
        return JSON.stringify(txt);
      }
      case "Expression": {
        const src = node.code;
        let out = "",
          pos = 0;
        while (true) {
          const open = src.indexOf("(", pos);
          if (open === -1) {
            out += src.slice(pos);
            break;
          }
          let j = open + 1;
          while (j < src.length && /\s/.test(src[j])) j++;
          if (src[j] !== "<") {
            out += src.slice(pos, open + 1);
            pos = open + 1;
            continue;
          }
          const { code, endIdx } = balance(src, open);
          let compiled = code;
          try {
            compiled = gen(parse(code));
          } catch {}
          out += src.slice(pos, open) + "(" + compiled + ")";
          pos = endIdx + 1;
        }
        return out;
      }
    }
    return "";
  }
  function balance(str, open) {
    let d = 0;
    for (let i = open; i < str.length; i++) {
      if (str[i] === "(") d++;
      else if (str[i] === ")" && --d === 0)
        return { code: str.slice(open + 1, i), endIdx: i };
    }
    throw Error("unbalanced");
  }

  function prettify(code) {
    return code;
    const indentWidth = 2;
    let out = "";
    let indent = 1;

    const tab = () => {
      indent++;
    };
    const untab = () => {
      indent = Math.max(0, indent - 1);
    };
    const pad = () => " ".repeat(indentWidth * indent);
    const trimLeft = (i) => {
      let j = i + 1;
      while (code[j] === " ") j++;
      return j - i;
    };

    for (let i = 0; i < code.length; i++) {
      const ch = code[i];

      if (ch === "}") {
        untab();
        out += "\n" + pad() + "}";
        continue;
      } else if (ch === "{") {
        tab();
        out += "{\n" + pad();
        continue;
      } else if (ch === ",") {
        out += ",\n" + pad();
        continue;
      }

      out += ch;
    }
    return out;
  }

  /*────────────────── Runtime Transformer ──────────────────*/
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
        const start = match.index + match[0].length - 1; // '(' 위치
        const { code: inner, endIdx } = balance(source, start);

        /*-------------------- PATCH --------------------*/
        if (!/^\s*</.test(inner)) {
          // JSX 아님 → 그대로 통과
          out += source.slice(offset, endIdx + 1);
          offset = endIdx + 1;
          if (source[offset] === ";") offset++;
          continue;
        }
        /*------------------------------------------------*/

        const compiled = prettify(gen(parse(inner)));
        out += source.slice(offset, start) + compiled;
        let nextPos = endIdx + 1;
        if (source[nextPos] === ";") nextPos++;
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
