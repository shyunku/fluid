let stateHooks = [];
let effectHooks = [];
let hookIndex = 0;
let root = null;
let rootComponent = null;

function h(type, props, ...children) {
  return {
    type,
    props: props ?? {},
    children: children.map((child) =>
      typeof child === "string" ? h("TEXT", { value: child }) : child
    ),
  };
}

function useState(initialValue) {
  const hi = hookIndex;
  stateHooks[hi] = stateHooks[hi] ?? initialValue;

  const setState = (newValue) => {
    if (typeof newValue === "function") {
      newValue = newValue(stateHooks[hi]);
    }
    stateHooks[hi] = newValue;
    renderRoot();
  };

  hookIndex++;
  return [() => stateHooks[hi], setState];
}

function useEffect(callback, deps) {
  const hi = hookIndex;
  const oldDeps = effectHooks[hi];
  const hasChanged = !oldDeps || deps.some((dep, i) => dep !== oldDeps[i]);

  if (hasChanged) {
    callback();
    effectHooks[hi] = deps;
  }

  hookIndex++;
}

function diff(parent, oldNode, newNode) {
  if (!oldNode) {
    parent.appendChild(createElement(newNode));
  } else if (!newNode) {
    parent.removeChild(oldNode.el);
  } else if (oldNode.type === "TEXT" && newNode.type === "TEXT") {
    if (oldNode.props.value !== newNode.props.value)
      oldNode.el.nodeValue = newNode.props.value;
    newNode.el = oldNode.el;
  } else if (changed(oldNode, newNode)) {
    const newEl = createElement(newNode);
    parent.replaceChild(newEl, oldNode.el);
    newNode.el = newEl;
  } else if (newNode.type) {
    for (let i = 0; i < newNode.children.length; i++) {
      diff(oldNode.el, oldNode.children[i], newNode.children[i]);
    }
  }
}

function changed(oldNode, newNode) {
  return (
    typeof oldNode !== typeof newNode ||
    (typeof oldNode === "string" && oldNode !== newNode) ||
    oldNode.type !== newNode.type
  );
}

function createElement(node) {
  if (node.type === "TEXT") {
    const el = document.createTextNode(node.props.value);
    node.el = el;
    return el;
  }

  const el = document.createElement(node.type);
  Object.entries(node.props).forEach(([key, value]) => {
    if (key.startsWith("on")) {
      el.addEventListener(key.substring(2).toLocaleLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  });

  node.children.map(createElement).forEach(el.appendChild.bind(el));
  node.el = el;
  return el;
}

function render(component, container) {
  hookIndex = 0;
  effectHooks = [];

  const newVNode = component();
  diff(container, container.vnode, newVNode);
  container.vnode = newVNode;
}

function renderRoot() {
  render(rootComponent, root);
}

function registerRoot(content) {
  document.addEventListener("DOMContentLoaded", () => {
    try {
      root = document.getElementById("root");
      rootComponent = content;
      renderRoot();
    } catch (err) {
      console.log("error: ", err.stack);
    }
  });
}
