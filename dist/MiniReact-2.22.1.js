/* MiniReact v2.22.1 */
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
  var EffectType = {
    PLACEMENT: "placement",
    UPDATE: "update",
    DELETE: "delete"
  };
  var VNode = class {
    constructor(type, props, key) {
      this.type = type;
      this.props = props;
      this.key = key;
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

  // src/react/cache.js
  var Cache = class {
    // 최상위 컴포넌트
    static rootComponent = null;
    // 최상위 노드 (DOM 노드)
    static rootTarget = null;
    // 최상위 Fiber
    static rootFiber = null;
    // 현재 렌더링 중인 Root Fiber
    static currentRoot = null;
    // 삭제할 Fiber List
    static deletions = [];
    // 다음 작업 단위
    static nextUnitOfWork = null;
    // 작업 루프 예약 여부
    static workLoopScheduled = false;
    // 현재 렌더링 중인 Fiber
    static wipFiber = null;
    // hooks.js에서 사용될 변수들
    static hookIndex = 0;
    // 렌더링
    static renderFunc = null;
    // 중복 예약 방지
    static scheduled = false;
    // 대기 중인 Effect List
    static pendingEffects = [];
  };

  // src/react/hooks.js
  function prepareToRender(fiber) {
    Cache.wipFiber = fiber;
    Cache.wipFiber.hooks = [];
    Cache.hookIndex = 0;
  }
  function flushUpdates() {
    Cache.scheduled = false;
    Cache.renderFunc();
    window.requestIdleCallback(workLoop);
  }
  function scheduleUpdate() {
    if (Cache.scheduled) return;
    Cache.scheduled = true;
    debug("SCHEDULE_UPDATE", "update batched");
    queueMicrotask(flushUpdates);
  }
  function runEffects() {
    Cache.pendingEffects.forEach((fn) => fn());
    Cache.pendingEffects.length = 0;
  }
  function useState(initial) {
    debug("USE_STATE", "useState initial:", initial);
    const oldHook = Cache.wipFiber.alternate?.hooks[Cache.hookIndex];
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
    Cache.wipFiber.hooks[Cache.hookIndex] = hook;
    debug("USE_STATE", "hook stored at index", Cache.hookIndex, hook, hook.queue);
    Cache.hookIndex++;
    return [hook.state, setState];
  }
  function useEffect(effect, deps) {
    const oldHook = Cache.wipFiber.alternate?.hooks[Cache.hookIndex];
    const prevDeps = oldHook?.deps || [];
    const hasChanged = oldHook ? !deps || deps.some((d, i) => !Object.is(d, prevDeps[i])) : true;
    const hook = {
      deps,
      cleanup: oldHook?.cleanup
    };
    if (hasChanged) {
      if (hook.cleanup) {
        Cache.pendingEffects.push(() => hook.cleanup());
      }
      Cache.pendingEffects.push(() => {
        const cleanupFn = effect();
        hook.cleanup = typeof cleanupFn === "function" ? cleanupFn : void 0;
      });
    }
    Cache.wipFiber.hooks[Cache.hookIndex] = hook;
    Cache.hookIndex++;
  }
  function useMemo(factory, deps) {
    const oldHook = Cache.wipFiber.alternate?.hooks[Cache.hookIndex];
    const hasChanged = oldHook ? !deps || deps.some((d, i) => !Object.is(d, oldHook.deps[i])) : true;
    const hook = { value: null, deps };
    if (hasChanged) {
      hook.value = factory();
    } else {
      hook.value = oldHook.value;
    }
    Cache.wipFiber.hooks[Cache.hookIndex] = hook;
    Cache.hookIndex++;
    return hook.value;
  }
  function useCallback(callback, deps) {
    return useMemo(() => callback, deps);
  }

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
    return parentFiber.stateNode ?? null;
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
        return node.stateNode ?? null;
    }
    return null;
  }
  function insertOrAppendDom(node, before, parentDom) {
    if (node.tag === NodeTagType.HOST || node.tag === NodeTagType.TEXT) {
      const target = node.stateNode;
      if (target) {
        if (before) {
          parentDom.insertBefore(target, before);
        } else {
          parentDom.appendChild(target);
        }
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
  var requestIdleCallback = window.requestIdleCallback || function(cb) {
    return requestAnimationFrame(() => cb({ timeRemaining: () => 1 }));
  };
  initialize();
  function initialize() {
    Cache.renderFunc = render;
    requestIdleCallback(workLoop);
  }
  function render(element, container) {
    Cache.rootComponent = element;
    Cache.rootTarget = container;
    Cache.renderFunc = () => render(Cache.rootComponent, Cache.rootTarget);
    Cache.rootFiber = new Fiber(null, {}, null);
    Cache.rootFiber.stateNode = Cache.rootTarget;
    Cache.rootFiber.alternate = Cache.currentRoot;
    prepareToRender(Cache.rootFiber);
    const vnode = typeof Cache.rootComponent === "function" ? Cache.rootComponent() : Cache.rootComponent;
    Cache.rootFiber.props = { children: [vnode] };
    Cache.deletions = [];
    Cache.nextUnitOfWork = Cache.rootFiber;
    ensureWorkLoop();
    debug("RENDER", "Render initialized:", Cache.rootFiber);
    window.vroot = Cache.rootFiber;
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
    Cache.deletions.forEach(commitWork);
    commitWork(Cache.rootFiber.child);
    Cache.currentRoot = Cache.rootFiber;
    Cache.rootFiber = null;
    runEffects();
    debug("COMMIT_ROOT", "Commit \uC644\uB8CC, currentRoot set to:", Cache.currentRoot);
  }
  function beginWork(fiber) {
    debug("BEGIN_WORK", "beginWork:", fiber);
    switch (fiber.tag) {
      case NodeTagType.TEXT: {
        if (fiber.effectTag === EffectType.PLACEMENT) {
          const textNode = document.createTextNode(fiber.props.nodeValue);
          fiber.stateNode = textNode;
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
        if (!fiber.stateNode) {
          debug("BEGIN_WORK", "Create host DOM:", fiber.type);
          const dom = document.createElement(fiber.type);
          applyProps(dom, fiber.props);
          fiber.stateNode = dom;
        } else if (fiber.effectTag === EffectType.PLACEMENT) {
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
    if (!parentDom) {
      console.error("Cannot find parent DOM for placement:", fiber);
      return;
    }
    const beforeDom = findHostSiblingDom(fiber);
    debug("COMMIT_WORK", "Placement:", fiber, parentDom, beforeDom);
    insertOrAppendDom(fiber, beforeDom, parentDom);
  }
  function commitUpdate(fiber) {
    const target = fiber.stateNode;
    if (!target) return;
    if (fiber.tag !== NodeTagType.HOST && fiber.tag !== NodeTagType.TEXT) return;
    if (!(target instanceof Element) && !(target instanceof Text)) return;
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
  function commitDelete(fiber, explicitParentDom = null) {
    debug("COMMIT_WORK", "Delete:", fiber);
    if (fiber.tag === NodeTagType.HOST || fiber.tag === NodeTagType.TEXT) {
      if (fiber.stateNode) {
        const parentDom = explicitParentDom || findHostParentDom(fiber);
        if (parentDom && fiber.stateNode.parentNode === parentDom) {
          parentDom.removeChild(fiber.stateNode);
        } else if (parentDom && !fiber.stateNode.parentNode) {
          debug(
            "COMMIT_WORK",
            "Node already removed or parent mismatch:",
            fiber,
            parentDom
          );
        } else if (!parentDom) {
          console.warn(
            "Parent DOM not found for deletion of:",
            fiber,
            "Current parentNode:",
            fiber.stateNode.parentNode
          );
        }
      }
    } else {
      if (fiber.child) {
        commitDelete(fiber.child, explicitParentDom || findHostParentDom(fiber));
      }
    }
    if (fiber.tag !== NodeTagType.HOST && fiber.tag !== NodeTagType.TEXT) {
      let child = fiber.child;
      while (child) {
        commitDelete(child, findHostParentDom(child));
        child = child.sibling;
      }
    }
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
  function reconcileChildren(wipFiber, elements) {
    debug("RECONCILE", "Reconciling children for:", wipFiber, elements);
    const existing = {};
    let oldFiber = wipFiber.alternate?.child;
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
        Cache.deletions.push(sameFiber);
      }
      if (newIndex === 0) {
        wipFiber.child = newFiber;
        if (newFiber) newFiber.parent = wipFiber;
      } else if (prevSibling && newFiber) {
        prevSibling.sibling = newFiber;
        newFiber.parent = wipFiber;
      }
      prevSibling = newFiber;
      newIndex++;
    }
    for (const key in existing) {
      const fiberToDelete = existing[key];
      fiberToDelete.effectTag = EffectType.DELETE;
      Cache.deletions.push(fiberToDelete);
    }
  }
  function shouldYield(start, deadline) {
    if (deadline) return deadline.timeRemaining() < 1;
    return performance.now() - start > 4;
  }
  function ensureWorkLoop() {
    if (!Cache.workLoopScheduled) {
      Cache.workLoopScheduled = true;
      requestIdleCallback(workLoop);
    }
  }
  function workLoop(deadline) {
    Cache.workLoopScheduled = false;
    debug("WORK_LOOP", "workLoop tick");
    let start = performance.now();
    while (Cache.nextUnitOfWork && !shouldYield(start, deadline)) {
      Cache.nextUnitOfWork = performUnitOfWork(Cache.nextUnitOfWork);
    }
    if (Cache.nextUnitOfWork) {
      ensureWorkLoop();
    } else if (Cache.rootFiber) {
      commitRoot();
      if (Cache.nextUnitOfWork) {
        ensureWorkLoop();
      }
    }
  }

  // src/react/h.js
  function h(type, props = {}, ...children) {
    props = props || {};
    const normalizedChildren = flatten(children).filter((e) => e !== true && e !== false && e != null).map((child) => {
      return typeof child === "object" ? child : new VNode(NodeTagType.TEXT, { nodeValue: child, children: [] }, null);
    });
    return new VNode(
      type,
      { ...props, children: normalizedChildren },
      props.key || null
    );
  }
  return __toCommonJS(index_exports);
})();
