/* MiniReact v2.21.2 */
var MiniReact = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/react/index.js
  var index_exports = {};
  __export(index_exports, {
    h: () => h,
    prepareToRender: () => prepareToRender,
    render: () => render,
    runEffects: () => runEffects,
    scheduleUpdate: () => scheduleUpdate,
    setRender: () => setRender,
    useCallback: () => useCallback,
    useEffect: () => useEffect,
    useMemo: () => useMemo,
    useState: () => useState,
    workLoop: () => workLoop
  });

  // src/react/types.js
  var NodeTagType = {
    HOST: "host",
    HOST_ROOT: "host_root",
    TEXT: "text",
    COMPONENT: "component"
  };
  var NodeType = {
    TEXT: "text"
  };
  var NodeConnectionType = {
    CHILD: "child",
    SIBLING: "sibling"
  };
  var EffectType = {
    PLACEMENT: "placement",
    UPDATE: "update",
    DELETE: "delete"
  };
  var FiberNode = class {
    constructor(dom) {
      this.target = dom;
      this.child = null;
      this.sibling = null;
      this.parent = null;
    }
    connect(type, node) {
      if (type === NodeConnectionType.CHILD) {
        node.parent = this;
        this.child = node;
      } else if (type === NodeConnectionType.SIBLING) {
        node.parent = this.parent;
        this.sibling = node;
      }
    }
  };
  var Fiber = class _Fiber {
    constructor(type, props, key) {
      this.tag = _Fiber.calculateTag(type);
      this.type = type;
      this.props = props;
      this.key = key;
      this.stateNode = null;
      this.hooks = [];
      this.alternate = null;
      this.parent = null;
      this.child = null;
      this.sibling = null;
      this.effectTag = null;
      this.componentName = this.tag === NodeTagType.COMPONENT ? type.name : null;
      this.index = null;
    }
    static calculateTag(type) {
      if (type === null) return NodeTagType.HOST_ROOT;
      if (type === NodeType.TEXT) return NodeTagType.TEXT;
      if (typeof type === "string") return NodeTagType.HOST;
      return NodeTagType.COMPONENT;
    }
  };

  // src/react/util.js
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
  function flatten(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.flat().reduce((acc, cur) => {
      return acc.concat(flatten(cur));
    }, []);
  }

  // src/react/h.js
  function h(type, props = {}, ...children) {
    props = props || {};
    const normalizedChildren = flatten(children).filter((e) => e !== true && e !== false && e != null).map((child) => {
      return typeof child === "object" ? child : {
        type: NodeTagType.TEXT,
        props: { nodeValue: child, children: [] },
        key: null
      };
    });
    return {
      type,
      props: { ...props, children: normalizedChildren },
      key: props.key || null
    };
  }

  // src/react/logger.js
  var LogFlags = {
    ALL: true,
    RENDER: false,
    BEGIN_WORK: false,
    COMPLETE_WORK: false,
    COMMIT_ROOT: false,
    WORK_LOOP: false,
    PERFORM_UNIT: false,
    COMMIT_WORK: false,
    APPLY_PROPS: false,
    RECONCILE: false,
    USE_STATE: false,
    SCHEDULE_UPDATE: false
  };
  function debug(flag, ...args) {
    if (LogFlags.ALL && LogFlags[flag]) {
      console.log(`\x1B[32m[${flag}]\x1B[0m`, ...args);
    }
  }

  // src/react/hooks.js
  var wipFiber = null;
  var hookIndex = 0;
  var renderCallback = null;
  var scheduled = false;
  var pendingEffects = [];
  function prepareToRender(fiber) {
    wipFiber = fiber;
    wipFiber.hooks = [];
    hookIndex = 0;
  }
  function setRender(fn) {
    renderCallback = fn;
  }
  function flushUpdates() {
    scheduled = false;
    renderCallback && renderCallback();
    window.requestIdleCallback(workLoop);
  }
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    debug("SCHEDULE_UPDATE", "update batched");
    queueMicrotask(flushUpdates);
  }
  function runEffects() {
    pendingEffects.forEach((fn) => fn());
    pendingEffects.length = 0;
  }
  function useState(initial) {
    debug("USE_STATE", "useState initial:", initial);
    const oldHook = wipFiber.alternate?.hooks[hookIndex];
    const hook = oldHook || { state: initial, queue: [] };
    hook.queue.forEach((action) => {
      hook.state = action(hook.state);
    });
    hook.queue = [];
    const setState = (action) => {
      debug("USE_STATE", "state update queued:", action);
      hook.queue.push(typeof action === "function" ? action : () => action);
      scheduleUpdate();
    };
    wipFiber.hooks[hookIndex] = hook;
    debug("USE_STATE", "hook stored at index", hookIndex, hook, hook.queue);
    hookIndex++;
    return [hook.state, setState];
  }
  function useEffect(effect, deps) {
    const oldHook = wipFiber.alternate?.hooks[hookIndex];
    const prevDeps = oldHook?.deps || [];
    const hasChanged = oldHook ? !deps || deps.some((d, i) => !Object.is(d, prevDeps[i])) : true;
    const hook = {
      deps,
      cleanup: oldHook?.cleanup
    };
    if (hasChanged) {
      if (hook.cleanup) {
        pendingEffects.push(() => hook.cleanup());
      }
      pendingEffects.push(() => {
        const cleanupFn = effect();
        hook.cleanup = typeof cleanupFn === "function" ? cleanupFn : void 0;
      });
    }
    wipFiber.hooks[hookIndex] = hook;
    hookIndex++;
  }
  function useMemo(factory, deps) {
    const oldHook = wipFiber.alternate?.hooks[hookIndex];
    const hasChanged = oldHook ? !deps || deps.some((d, i) => !Object.is(d, oldHook.deps[i])) : true;
    const hook = { value: null, deps };
    if (hasChanged) {
      hook.value = factory();
    } else {
      hook.value = oldHook.value;
    }
    wipFiber.hooks[hookIndex] = hook;
    hookIndex++;
    return hook.value;
  }
  function useCallback(callback, deps) {
    return useMemo(() => callback, deps);
  }

  // src/react/domUtil.js
  function findHostParentFiber(fiber) {
    let p = fiber.parent;
    while (p && p.tag !== NodeTagType.HOST && p.tag !== NodeTagType.HOST_ROOT) {
      p = p.parent;
    }
    return p;
  }
  function findHostParentDom(fiber) {
    const parentFiber = findHostParentFiber(fiber);
    if (!parentFiber) return null;
    return parentFiber.stateNode?.target ?? null;
  }
  function findHostSiblingDom(fiber) {
    let node = fiber;
    findSibling: while (node) {
      while (!node.sibling) {
        if (!node.parent || node.parent.tag === NodeTagType.HOST_ROOT || node.parent.tag === NodeTagType.HOST)
          return null;
        node = node.parent;
      }
      node = node.sibling;
      while (node.tag !== NodeTagType.HOST && node.tag !== NodeTagType.TEXT) {
        if (node.effectTag && node.effectTag === EffectType.PLACEMENT)
          continue findSibling;
        node = node.child;
      }
      if (!(node.effectTag && node.effectTag === EffectType.PLACEMENT))
        return node.stateNode?.target ?? null;
    }
    return null;
  }
  function insertOrAppendDom(node, before, parentDom) {
    if (node.tag === NodeTagType.HOST || node.tag === NodeTagType.TEXT) {
      const target = node.stateNode?.target;
      if (before) {
        parentDom.insertBefore(target, before);
      } else {
        parentDom.appendChild(target);
      }
      return;
    }
    let child = node.child;
    while (child) {
      insertOrAppendDom(child, before, parentDom);
      child = child.sibling;
    }
  }

  // src/react/core.js
  var currentApp = null;
  var currentContainer = null;
  var wipRoot = null;
  var currentRoot = null;
  var deletions = [];
  var nextUnitOfWork = null;
  requestIdleCallback(workLoop);
  function render(element, container) {
    currentApp = element;
    currentContainer = container;
    setRender(() => render(currentApp, currentContainer));
    wipRoot = new Fiber(null, {}, null);
    wipRoot.stateNode = new FiberNode(container);
    wipRoot.alternate = currentRoot;
    prepareToRender(wipRoot);
    const vnode = typeof element === "function" ? element() : element;
    wipRoot.props = { children: [vnode] };
    deletions = [];
    nextUnitOfWork = wipRoot;
    debug("RENDER", "Render initialized:", wipRoot);
    window.vroot = wipRoot;
  }
  function performUnitOfWork(fiber) {
    debug("PERFORM_UNIT", "performUnitOfWork on:", fiber);
    beginWork(fiber);
    if (fiber.child) return fiber.child;
    let next = fiber;
    while (next) {
      completeWork(next);
      if (next.sibling) return next.sibling;
      next = next.parent;
    }
    return null;
  }
  function commitRoot() {
    debug("COMMIT_ROOT", "Commit Root \uC2DC\uC791");
    deletions.forEach(commitWork);
    commitWork(wipRoot.child);
    currentRoot = wipRoot;
    wipRoot = null;
    runEffects();
    debug("COMMIT_ROOT", "Commit \uC644\uB8CC, currentRoot set to:", currentRoot);
  }
  function beginWork(fiber) {
    debug("BEGIN_WORK", "beginWork:", fiber);
    switch (fiber.tag) {
      case NodeTagType.TEXT: {
        if (fiber.effectTag === EffectType.PLACEMENT) {
          const textNode = document.createTextNode(fiber.props.nodeValue);
          fiber.stateNode = new FiberNode(textNode);
        }
        break;
      }
      case NodeTagType.COMPONENT: {
        debug("BEGIN_WORK", "Component render for", fiber.componentName);
        prepareToRender(fiber);
        const element = fiber.type(fiber.props) || { props: { children: [] } };
        reconcileChildren(fiber, [element]);
        break;
      }
      case NodeTagType.HOST: {
        if (fiber.effectTag === EffectType.PLACEMENT) {
          debug("BEGIN_WORK", "Create host DOM:", fiber.type);
          const dom = document.createElement(fiber.type);
          applyProps(dom, fiber.props);
          fiber.stateNode = new FiberNode(dom);
        }
        reconcileChildren(fiber, fiber.props.children);
        break;
      }
      case NodeTagType.HOST_ROOT: {
        reconcileChildren(fiber, fiber.props.children);
        break;
      }
    }
  }
  function completeWork(fiber) {
    debug("COMPLETE_WORK", "completeWork for:", fiber);
    if (!(fiber?.stateNode instanceof FiberNode)) return;
    let parentFiber = fiber.parent;
    while (parentFiber && !(parentFiber.stateNode instanceof FiberNode)) {
      parentFiber = parentFiber.parent;
    }
    if (!parentFiber) return;
    const parentNode = parentFiber.stateNode;
    debug("COMPLETE_WORK", "connect CHILD:", parentNode, fiber.stateNode);
    parentNode.connect(NodeConnectionType.CHILD, fiber.stateNode);
    let sib = parentNode.child;
    while (sib && sib.sibling) sib = sib.sibling;
    if (sib && sib !== fiber.stateNode) {
      debug("COMPLETE_WORK", "connect SIBLING:", parentNode, fiber.stateNode);
      parentNode.connect(NodeConnectionType.SIBLING, fiber.stateNode);
    }
  }
  function commitWork(fiber) {
    if (!fiber) return;
    if (fiber.effectTag === EffectType.PLACEMENT) {
      commitPlacement(fiber);
    } else if (fiber.effectTag === EffectType.UPDATE) {
      commitUpdate(fiber);
    } else if (fiber.effectTag === EffectType.DELETE) {
      commitDelete(fiber);
      return;
    }
    commitWork(fiber.child);
    commitWork(fiber.sibling);
  }
  function commitPlacement(fiber) {
    const parentDom = findHostParentDom(fiber);
    const beforeDom = findHostSiblingDom(fiber);
    debug("COMMIT_WORK", "Placement:", fiber, parentDom, beforeDom);
    insertOrAppendDom(fiber, beforeDom, parentDom);
  }
  function commitUpdate(fiber) {
    const target = fiber.stateNode?.target;
    if (!target) return;
    debug(
      "COMMIT_WORK",
      "Update:",
      fiber,
      target,
      fiber.alternate.props,
      fiber.props
    );
    if (changed(fiber.alternate.props, fiber.props)) {
      updateDom(target, fiber.alternate.props, fiber.props);
    }
  }
  function commitDelete(fiber) {
    debug("COMMIT_WORK", "Delete:", fiber);
    const parentDom = findHostParentDom(fiber);
    commitDeletion(fiber, parentDom);
  }
  function applyProps(dom, props) {
    debug("APPLY_PROPS", "applyProps for:", dom, props);
    Object.keys(props).filter((k) => k !== "children" && k !== "key" && k !== "nodeValue").forEach((name) => {
      if (name.startsWith("on") && typeof props[name] === "function") {
        const eventType = name.slice(2).toLowerCase();
        debug("APPLY_PROPS", `addEventListener: ${eventType}`);
        switch (eventType) {
          case "change":
            dom.addEventListener("input", props[name]);
            break;
          default:
            dom.addEventListener(eventType, props[name]);
            break;
        }
      } else if (name === "className") {
        dom.className = props[name];
      } else {
        applyProp(dom, name, props[name]);
      }
    });
  }
  function applyProp(dom, name, value) {
    if (name === "style" && typeof value === "object") {
      Object.assign(dom.style, value);
    } else if (name === "dangerouslySetInnerHTML") {
      dom.innerHTML = value.__html;
    } else if (!(name in dom)) {
      dom.setAttribute(name, value);
    } else {
      dom[name] = value;
    }
  }
  function updateDom(dom, prevProps, nextProps) {
    Object.keys(prevProps).filter((name) => name.startsWith("on")).forEach((name) => {
      if (!(name in nextProps) || prevProps[name] !== nextProps[name]) {
        dom.removeEventListener(name.slice(2).toLowerCase(), prevProps[name]);
      }
    });
    Object.keys(prevProps).filter((name) => name !== "children" && !name.startsWith("on")).forEach((name) => {
      if (!(name in nextProps)) dom[name] = "";
    });
    Object.keys(nextProps).filter((name) => name !== "children").forEach((name) => {
      if (prevProps[name] === nextProps[name]) return;
      if (name.startsWith("on") && typeof nextProps[name] === "function") {
        const eventType = name.slice(2).toLowerCase();
        dom.addEventListener(eventType, nextProps[name]);
      } else if (name === "className") {
        dom.className = nextProps[name];
      } else {
        applyProp(dom, name, nextProps[name]);
      }
    });
  }
  function commitDeletion(fiber, parentDom) {
    if (!fiber) return;
    if (fiber.stateNode?.target) {
      parentDom.removeChild(fiber.stateNode.target);
    } else {
      commitDeletion(fiber.child, parentDom);
    }
  }
  function reconcileChildren(wipFiber2, elements) {
    debug("RECONCILE", "Reconciling children for:", wipFiber2, elements);
    const existing = {};
    let oldFiber = wipFiber2.alternate?.child;
    let index = 0;
    while (oldFiber) {
      const key = oldFiber.key ?? index;
      oldFiber.index = index;
      existing[key] = oldFiber;
      oldFiber = oldFiber.sibling;
      index++;
    }
    let newIndex = 0;
    let prevSibling = null;
    let lastPlacedIndex = 0;
    for (const element of elements) {
      element.key = element.props.key ?? null;
      const key = element.key ?? newIndex;
      const sameFiber = existing[key];
      let newFiber = null;
      if (sameFiber && element.type === sameFiber.type) {
        newFiber = new Fiber(sameFiber.type, element.props, key);
        newFiber.stateNode = sameFiber.stateNode;
        newFiber.alternate = sameFiber;
        newFiber.effectTag = EffectType.UPDATE;
        newFiber.index = newIndex;
        if (sameFiber.index < lastPlacedIndex) {
          newFiber.effectTag = EffectType.PLACEMENT;
        } else {
          lastPlacedIndex = sameFiber.index;
        }
        delete existing[key];
      } else if (element) {
        newFiber = new Fiber(element.type, element.props, key);
        newFiber.effectTag = EffectType.PLACEMENT;
      }
      if (sameFiber && !newFiber) {
        sameFiber.effectTag = EffectType.DELETE;
        deletions.push(sameFiber);
      }
      if (newIndex === 0) {
        wipFiber2.child = newFiber;
        if (newFiber) newFiber.parent = wipFiber2;
      } else if (prevSibling && newFiber) {
        prevSibling.sibling = newFiber;
        newFiber.parent = wipFiber2;
      }
      prevSibling = newFiber;
      newIndex++;
    }
    for (const key in existing) {
      const fiberToDelete = existing[key];
      fiberToDelete.effectTag = EffectType.DELETE;
      deletions.push(fiberToDelete);
    }
  }
  function shouldYield(start, deadline) {
    if (deadline) return deadline.timeRemaining() < 1;
    return performance.now() - start > 4;
  }
  function workLoop(deadline) {
    debug("WORK_LOOP", "workLoop tick");
    let start = performance.now();
    while (nextUnitOfWork && !shouldYield(start, deadline)) {
      nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    }
    if (nextUnitOfWork) {
      requestIdleCallback(workLoop);
    } else if (wipRoot) {
      commitRoot();
      if (nextUnitOfWork) {
        requestIdleCallback(workLoop);
      }
    }
  }
  return __toCommonJS(index_exports);
})();
