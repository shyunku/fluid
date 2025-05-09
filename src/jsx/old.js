const closeTagRegex = /<(?<tagName>[a-zA-Z0-9]+)(?<props>[^>]+)?\/>/gs;
const openTagRegex =
  /<(?<tagName>[a-zA-Z0-9]+)(?<props>(?:\{[^}]*\}|[^>])*?)>(?<children>.*)<\/\1>/gs;
const unifiedTagRegex =
  /<(?<tagName>[a-zA-Z0-9]+)(?<props>(?:\{[^}]*\}|[^>/])*)\s*(?<selfClose>\/)?>(?:(?<children>.*?)<\/\1>)?/gs;

console.log(
  matchAll(
    `
        <div className="header">
        <div className="id">id: {thisId}</div>
        <button onClick={onItemClick}>add child</button>
        {parentId != null && index > 0 && (
          <button onClick={(e) => onParentItemMove(index, -1)}>up</button>
        )}
        {parentId != null && index < indexEnd && (
          <button onClick={(e) => onParentItemMove(index, 1)}>down</button>
        )}
        <input onChange={(e) => setInput(e.target.value)} value={input} />
        {input}/{duration}ms
      </div>
  `,
    unifiedTagRegex
  )
);

const scripts = document.querySelectorAll('script[type="text/jsx"]');
scripts.forEach(async (script) => {
  const src = script.src;
  const res = await fetch(src);
  let code = await res.text();
  const newCode = convertJsxToJs(code);
  console.log(newCode);
});

function convertJsxToJs(target) {
  const transactions = [];
  const closedTagMatches = matchAll(target, closeTagRegex);
  for (let ctm of closedTagMatches) {
    const { tagName, props } = ctm.groups;
    const propMap = transformProps(props);
    const tx = getTransform(ctm, tagName, propMap);
    transactions.push(tx);
  }

  const openedTagMatches = matchAll(target, openTagRegex);
  for (let ctm of openedTagMatches) {
    const { tagName, props, children } = ctm.groups;
    const propMap = transformProps(props);
    const tx = getTransform(ctm, tagName, propMap, children);
    transactions.push(tx);
  }

  // descending order
  transactions.sort((t1, t2) => t2.pos - t1.pos);
  transactions.forEach((t) => {
    target = execute(target, t);
  });

  return target;
}

function getTransform(match, tagName, propMap, children = "") {
  const targetPos = match.index;
  const targetLength = match[0].length;
  const { __extra, ...restProps } = propMap;

  let propSegment = Object.keys(restProps)
    .map((k) => {
      return `${k}: ${restProps[k]}`;
    })
    .join(", ");
  __extra.forEach((extra) => {
    propSegment += `, {${extra}}`;
  });

  const transformedChildren = transformChildren(children);
  const replaced = `h(${tagName}, {${propSegment}}, [${transformedChildren}])`;
  const commit = {
    pos: targetPos,
    len: targetLength,
    replace: replaced,
  };
  return commit;
}

function execute(target, transaction) {
  const { pos, len, replace } = transaction;
  return target.slice(0, pos) + replace + target.slice(pos + len);
}

function transformProps(propsRaw) {
  if (!propsRaw) return {};
  let raw = propsRaw
    .trim()
    .replace(/\n+/g, " ")
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ");
  const dictionary = { __extra: [] };
  let key = "";
  let value = "";
  let parsingValue = false;
  let parsingString = false;
  let expectingValue = false;
  let closeType = null;
  let layer = 0;

  const finalize = () => {
    key = key.trim();
    value = value.trim();
    if (value.length === 0) return;

    if (key.length === 0) {
      dictionary.__extra.push(value);
    } else {
      dictionary[key] = value;
    }
  };

  let index = -1;
  for (let c of raw) {
    index++;
    const parsing = parsingString || parsingValue;
    // console.log(raw, "c: ", c);

    if (c === " " && expectingValue) continue;
    if (c === "=" && !parsing) {
      expectingValue = true;
      continue;
    }
    if (c === "{") {
      if (layer === 0) {
        parsingValue = true;
        expectingValue = false;
      }
      layer++;
      if (layer === 1) continue;
    } else if (c === "}") {
      if (layer === 1) {
        finalize();

        parsingValue = false;
        key = "";
        value = "";
      }
      layer--;
      if (layer === 0) continue;
    }

    if (parsingString && c === closeType) {
      value += c;
      finalize();
      parsingString = false;
      closeType = 0;
      continue;
    }

    if (expectingValue && (c === '"' || c === "'")) {
      closeType = c;
      parsingString = true;
      expectingValue = false;
    }

    if (expectingValue && !parsing) {
      showError(raw, index);
    }

    if (parsingValue || parsingString) {
      value += c;
    } else {
      key += c;
    }
  }
  finalize();

  return dictionary;
}

// children to converted string
function transformChildren(childrenRaw) {
  let results = [];
  childrenRaw = childrenRaw
    .trim()
    .replace(/\n+/g, " ")
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ");
  const matches = matchAll(childrenRaw, unifiedTagRegex);
  console.log(childrenRaw);
  for (let match of matches) {
    const { tagName, props, children } = match.groups;
    const propMap = transformProps(props);

    const { __extra, ...restProps } = propMap;

    let propSegment = Object.keys(restProps)
      .map((k) => {
        return `${k}: ${restProps[k]}`;
      })
      .join(", ");
    __extra.forEach((extra) => {
      propSegment += `, {${extra}}`;
    });
    const transformedChildren = transformChildren(children);
    results.push(`h(${tagName}, {${propSegment}}, [${transformedChildren}])`);
  }
  console.log(results);
  return results.join(", ");
}

function matchAll(str, regex) {
  const rawMatches = str.matchAll(regex);
  const matches = [];
  while (true) {
    const item = rawMatches.next();
    if (item.done) break;
    matches.push(item.value);
  }
  return matches;
}

function showError(str, index) {
  const maxShowTokens = 20;
  throw new Error(
    `Non-closed value attribute at ...${str.substr(
      Math.max(0, index - maxShowTokens),
      2 * maxShowTokens
    )}...\n${" ".repeat(Math.min(maxShowTokens, index) + 64)}^^ error here!`
  );
}
