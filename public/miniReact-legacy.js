(function (global) {
  const TEXT_ELEMENT = "TEXT_ELEMENT";

  function changed(a, b) {
    if (a === b) return false;
    if (a == null || b == null) return a !== b;
    if (typeof a !== "object" || typeof b !== "object") return a !== b;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return true;
      return a.some((item, index) => changed(item, b[index]));
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return true;
    return keysA.some((key) => changed(a[key], b[key]));
  }

  function h(type, props = {}, ...children) {
    props = props || {};
    const normalizedChildren = children
      .flat()
      .map((child) =>
        typeof child === "string" || typeof child === "number"
          ? { type: TEXT_ELEMENT, props: { nodeValue: child } }
          : child
      )
      .filter(Boolean);
    return {
      type,
      props: {
        ...props,
        children: normalizedChildren,
      },
      key: props.key,
    };
  }

  // === 상태 저장 구조 변경 (배열 -> Map 구조) ===
  const componentStates = new Map(); // key => stateArray
  let currentComponentKey = null;
  let hookIndex = 0;
  let componentMissingKeyWarned = false;

  function useState(initialState) {
    const states = componentStates.get(currentComponentKey) || [];
    if (states[hookIndex] === undefined) {
      states[hookIndex] =
        typeof initialState === "function" ? initialState() : initialState;
      componentStates.set(currentComponentKey, states);
    }
    const stateIndex = hookIndex;
    const setState = (newState) => {
      const value =
        typeof newState === "function"
          ? newState(states[stateIndex])
          : newState;
      if (changed(states[stateIndex], value)) {
        states[stateIndex] = value;
        rerender();
      }
    };
    console.log(currentComponentKey, componentStates);
    return [states[hookIndex++], setState];
  }

  function useEffect(callback, deps) {
    const states = componentStates.get(currentComponentKey) || [];
    const state = states[hookIndex];
    const hasChanged =
      !state ||
      !deps ||
      state.deps?.length !== deps.length ||
      deps.some((dep, i) => changed(dep, state.deps[i]));
    if (hasChanged) {
      queueMicrotask(callback);
      states[hookIndex] = { deps };
      componentStates.set(currentComponentKey, states);
    }
    hookIndex++;
  }

  function useMemo(factory, deps) {
    const states = componentStates.get(currentComponentKey) || [];
    const oldMemo = states[hookIndex];
    if (
      !oldMemo ||
      !deps ||
      deps.some((dep, i) => changed(dep, oldMemo.deps[i]))
    ) {
      const value = factory();
      states[hookIndex] = { value, deps };
      componentStates.set(currentComponentKey, states);
      hookIndex++;
      return value;
    }
    hookIndex++;
    return oldMemo.value;
  }

  function useCallback(callback, deps) {
    return useMemo(() => callback, deps);
  }

  function updateProps(element, props) {
    for (let name in element) {
      if (name.startsWith("on")) {
        element[name] = null;
      }
    }
    for (let name in props) {
      if (name === "children") continue;
      if (name.startsWith("on")) {
        element[name.toLowerCase()] = props[name];
      } else if (
        name === "value" &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)
      ) {
        if (element.value !== props[name]) {
          element.value = props[name];
        }
      } else if (name !== "key") {
        element.setAttribute(name, props[name]);
      }
    }
  }

  // 8자리 HEX string 생성 함수
  function generate8Hex() {
    return (
      "00000000" + Math.floor(Math.random() * 0xffffffff).toString(16)
    ).slice(-8);
  }

  // 부모 key 경로와 현재 vnode로부터 full key를 생성하는 함수
  // [수정] 함수형 컴포넌트도 부모 key에 이어서 full key를 생성하도록 함.
  // vnode.key가 없으면 8자리 HEX string을 사용하여 {componentName}.{hex} 형식으로 localKey를 생성.
  function computeFullKey(vnode, parentKey) {
    let localKey;
    if (typeof vnode.type === "function") {
      if (vnode.key != null) {
        localKey = `${vnode.type.name}.${vnode.key}`;
      } else {
        localKey = `${vnode.type.name}.${generate8Hex()}`;
      }
    } else {
      localKey = vnode.key != null ? vnode.key : vnode.type;
    }
    return parentKey ? `${parentKey}:${localKey}` : localKey;
  }

  function render(vnode, container) {
    // 초기 부모 key는 빈 문자열로 시작
    const fullKey = "";
    hookIndex = 0;
    currentComponentKey = computeFullKey(vnode, fullKey);
    console.log(vnode, container);
    const existingDom = container.firstChild;
    if (existingDom) {
      const newDom = createElement(vnode, existingDom, fullKey);
      if (newDom !== existingDom) {
        container.replaceChild(newDom, existingDom);
      }
    } else {
      const dom = createElement(vnode, null, fullKey);
      container.appendChild(dom);
    }
  }

  // createElement를 수정하여 부모 key 경로를 인자로 받음
  function createElement(vnode, existingElement = null, parentKey = "") {
    if (!vnode) return null;
    if (typeof vnode.type === "function") {
      // 재귀적으로 부모 key 경로를 전달하여 full key를 생성
      return renderComponent(vnode, parentKey);
    }
    if (vnode.type === TEXT_ELEMENT) {
      if (
        existingElement &&
        existingElement.nodeType === Node.TEXT_NODE &&
        existingElement.nodeValue !== vnode.props.nodeValue
      ) {
        existingElement.nodeValue = vnode.props.nodeValue;
        return existingElement;
      }
      return document.createTextNode(vnode.props.nodeValue);
    }
    const element = existingElement || document.createElement(vnode.type);
    const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
    const wasActive = document.activeElement === element;
    const oldValue = isInput ? element.value : null;
    updateProps(element, vnode.props || {});
    if (isInput && oldValue !== null && vnode.props.value !== oldValue) {
      element.value = oldValue;
    }
    if (wasActive) element.focus();
    // 자식 렌더링 시, 현재의 full key를 부모 key 경로로 전달
    reconcileChildren(
      element,
      vnode.props.children || [],
      computeFullKey(vnode, parentKey)
    );
    return element;
  }

  // reconcileChildren도 부모 key 경로를 각 자식에게 전달
  function reconcileChildren(parent, newChildren, parentKey) {
    const existingChildren = Array.from(parent.childNodes);
    const maxLength = Math.max(existingChildren.length, newChildren.length);
    for (let i = 0; i < maxLength; i++) {
      const existingChild = existingChildren[i];
      const newChild = newChildren[i];
      if (
        newChild &&
        typeof newChild.type === "function" &&
        newChild.key == null &&
        !componentMissingKeyWarned
      ) {
        console.warn(
          `[MiniReact Warning] Component "${
            newChild.type.name || "Anonymous"
          }" at position ${i} is missing a 'key' prop. This may cause state mismatches when components are reordered or removed.`
        );
        componentMissingKeyWarned = true;
      }
      if (!existingChild && newChild) {
        parent.appendChild(createElement(newChild, null, parentKey));
      } else if (existingChild && !newChild) {
        parent.removeChild(existingChild);
      } else if (existingChild && newChild) {
        const updatedChild = createElement(newChild, existingChild, parentKey);
        if (updatedChild !== existingChild) {
          parent.replaceChild(updatedChild, existingChild);
        }
      }
    }
  }

  // renderComponent 수정: 부모 key 경로를 받아 full key 생성
  function renderComponent(vnode, parentKey = "") {
    console.log("render component");
    const fullKey = computeFullKey(vnode, parentKey);
    currentComponentKey = fullKey;
    hookIndex = 0;
    const rendered = vnode.type(vnode.props);
    const el = createElement(rendered, null, fullKey);
    el.__vnode = vnode;
    return el;
  }

  function rerender() {
    componentMissingKeyWarned = false;
    const root = document.getElementById("root");
    if (root && window.App) {
      render(window.App(), root);
    } else {
      
    }
  }

  function renderRoot(app) {
    window.App = app;
    rerender();
  }

  global.h = h;
  global.render = render;
  global.changed = changed;
  global.useState = useState;
  global.useEffect = useEffect;
  global.useMemo = useMemo;
  global.useCallback = useCallback;
  global.renderRoot = renderRoot;
  global.debug = { componentStates };
})(window);
