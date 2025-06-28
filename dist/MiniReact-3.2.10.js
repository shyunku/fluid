/* MiniReact v3.2.10 */
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
    Link: () => Link,
    Route: () => Route,
    Router: () => Router,
    createContext: () => createContext,
    ensureWorkLoop: () => ensureWorkLoop,
    h: () => h,
    prepareToRender: () => prepareToRender,
    render: () => render,
    runEffects: () => runEffects,
    scheduleUpdate: () => scheduleUpdate,
    useCallback: () => useCallback,
    useContext: () => useContext,
    useEffect: () => useEffect,
    useLocation: () => useLocation,
    useMemo: () => useMemo,
    useNavigate: () => useNavigate,
    useReducer: () => useReducer,
    useRef: () => useRef,
    useState: () => useState,
    workLoop: () => workLoop
  });

  // src/react/types.js
  var NodeTagType = {
    HOST: "host",
    HOST_ROOT: "host_root",
    TEXT: "text",
    COMPONENT: "component",
    PROVIDER: "provider"
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
    /**
     * 가상 노드를 생성합니다.
     * @param {string|function} type
     * @param {object} props
     * @param {string|number} key
     */
    constructor(type, props, key) {
      this.type = type;
      this.props = props;
      this.key = key;
    }
  };
  var Fiber = class _Fiber {
    /**
     * 파이버 노드를 생성합니다.
     * @param {string|function} type
     * @param {object} props
     * @param {string|number} key
     */
    constructor(type, props, key) {
      this.tag = _Fiber.calculateTag(type);
      this.type = type;
      this.props = props;
      this.key = key;
      this.stateNode = null;
      this.memoizedState = null;
      this.alternate = null;
      this.parent = null;
      this.child = null;
      this.sibling = null;
      this.effectTag = null;
      this.componentName = this.tag === NodeTagType.COMPONENT ? type.name : null;
      this.index = null;
      this._contextHasChanged = false;
    }
    /**
     * 파이버의 태그를 계산합니다.
     * @param {string|function} type
     * @returns {string}
     */
    static calculateTag(type) {
      if (type === null) return NodeTagType.HOST_ROOT;
      if (type === NodeType.TEXT) return NodeTagType.TEXT;
      if (typeof type === "string") return NodeTagType.HOST;
      if (typeof type === "object" && type !== null && type.$$typeof === Symbol.for("react.provider")) {
        return NodeTagType.PROVIDER;
      }
      return NodeTagType.COMPONENT;
    }
    /**
     * 파이버를 복제합니다.
     * @returns {Fiber}
     */
    clone() {
      const newFiber = new _Fiber(this.type, this.props, this.key);
      newFiber.stateNode = this.stateNode;
      newFiber.alternate = this;
      this.alternate = null;
      return newFiber;
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
    USE_REF: false,
    USE_CONTEXT: false,
    CONTEXT: false,
    SCHEDULE_UPDATE: false,
    LIFECYCLE: false,
    ROUTER: false,
    ERROR_BOUNDARY: false
  };
  var noop = () => {
  };
  function debug(flag) {
    if (!LogFlags.hasOwnProperty(flag)) {
      console.error(
        `[MiniReact Error] \uB85C\uADF8 \uD50C\uB798\uADF8 "${flag}"\uAC00 \uC815\uC758\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.`
      );
      return noop;
    }
    if (LogFlags.ALL && LogFlags[flag]) {
      return console.log.bind(console, `\x1B[32m[${flag}]\x1B[0m`);
    }
    return noop;
  }
  function warn(flag) {
    if (!LogFlags.hasOwnProperty(flag)) {
      console.error(
        `[MiniReact Error] \uB85C\uADF8 \uD50C\uB798\uADF8 "${flag}"\uAC00 \uC815\uC758\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.`
      );
      return noop;
    }
    return console.warn.bind(console, `\x1B[33m[${flag}]\x1B[0m`);
  }
  function error(flag) {
    if (!LogFlags.hasOwnProperty(flag)) {
      console.error(
        `[MiniReact Error] \uB85C\uADF8 \uD50C\uB798\uADF8 "${flag}"\uAC00 \uC815\uC758\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.`
      );
      return noop;
    }
    return console.error.bind(console, `\x1B[31m[${flag}]\x1B[0m`);
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
    // alternate(current) 훅 리스트를 순회하는 포인터
    static currentHook = null;
    // wip 훅 리스트를 순회하는 포인터
    static wipHook = null;
    // 렌더링
    static renderFunc = null;
    // 중복 예약 방지
    static scheduled = false;
    // 대기 중인 Effect List
    static pendingEffects = [];
    // Context 스택
    static contextStack = [];
    // 컨텍스트 변경에 따른 강제 리렌더링 카운터
    static forceRenderDescendantsCount = 0;
  };

  // src/react/hooks.js
  function prepareToRender(fiber) {
    Cache.wipFiber = fiber;
    Cache.wipHook = null;
    Cache.currentHook = null;
  }
  function flushUpdates() {
    Cache.scheduled = false;
    if (!Cache.currentRoot) {
      return;
    }
    const newRootFiber = new Fiber(null, Cache.currentRoot.props, null);
    newRootFiber.stateNode = Cache.currentRoot.stateNode;
    newRootFiber.alternate = Cache.currentRoot;
    newRootFiber.alternate.alternate = null;
    Cache.rootFiber = newRootFiber;
    Cache.deletions = [];
    Cache.nextUnitOfWork = Cache.rootFiber;
    window.rootFiber = Cache.rootFiber;
    window.currentRoot = Cache.currentRoot;
    ensureWorkLoop();
  }
  function scheduleUpdate() {
    if (Cache.scheduled) return;
    Cache.scheduled = true;
    debug("SCHEDULE_UPDATE")("update batched");
    queueMicrotask(flushUpdates);
  }
  function runEffects() {
    Cache.pendingEffects.forEach((effect) => {
      if (effect.destroy) {
        effect.destroy();
      }
      const cleanupFn = effect.create();
      if (typeof cleanupFn === "function") {
        effect.destroy = cleanupFn;
      }
    });
    Cache.pendingEffects.length = 0;
  }
  function mountWorkInProgressHook() {
    const hook = {
      memoizedState: null,
      queue: null,
      next: null
    };
    if (Cache.wipHook === null) {
      Cache.wipFiber.memoizedState = Cache.wipHook = hook;
    } else {
      Cache.wipHook = Cache.wipHook.next = hook;
    }
    return Cache.wipHook;
  }
  function updateWorkInProgressHook() {
    const oldHook = Cache.currentHook ? Cache.currentHook.next : Cache.wipFiber.alternate.memoizedState;
    Cache.currentHook = oldHook;
    const newHook = {
      memoizedState: oldHook.memoizedState,
      queue: oldHook.queue,
      next: null,
      deps: oldHook.deps
    };
    if (Cache.wipHook === null) {
      Cache.wipFiber.memoizedState = Cache.wipHook = newHook;
    } else {
      Cache.wipHook = Cache.wipHook.next = newHook;
    }
    return Cache.wipHook;
  }
  function dispatchAction(queue, action) {
    const update = { action, next: null };
    const pending = queue.pending;
    if (pending === null) {
      update.next = update;
    } else {
      update.next = pending.next;
      pending.next = update;
    }
    queue.pending = update;
    scheduleUpdate();
  }
  function useState(initialState) {
    return useReducer((state, action) => {
      return typeof action === "function" ? action(state) : action;
    }, initialState);
  }
  function useReducer(reducer, initialState) {
    const hook = Cache.wipFiber.alternate ? updateWorkInProgressHook() : mountWorkInProgressHook();
    if (hook.queue === null) {
      hook.memoizedState = typeof initialState === "function" ? initialState() : initialState;
      hook.queue = { pending: null };
      const dispatch = dispatchAction.bind(null, hook.queue);
      hook.queue.dispatch = dispatch;
    }
    if (hook.queue.pending) {
      let firstUpdate = hook.queue.pending.next;
      let newState = hook.memoizedState;
      do {
        newState = reducer(newState, firstUpdate.action);
        firstUpdate = firstUpdate.next;
      } while (firstUpdate !== hook.queue.pending.next);
      hook.memoizedState = newState;
      hook.queue.pending = null;
    }
    return [hook.memoizedState, hook.queue.dispatch];
  }
  function useEffect(create, deps) {
    const hook = Cache.wipFiber.alternate ? updateWorkInProgressHook() : mountWorkInProgressHook();
    const oldDeps = hook.deps;
    const hasChanged = !deps || !oldDeps || deps.some((d, i) => !Object.is(d, oldDeps[i]));
    if (hasChanged) {
      const newEffect = {
        create,
        destroy: hook.memoizedState ? hook.memoizedState.destroy : void 0,
        // 이전 effect의 destroy 함수를 가져옴
        deps
      };
      hook.memoizedState = newEffect;
      Cache.pendingEffects.push(newEffect);
    }
    hook.deps = deps;
  }
  function useMemo(factory, deps) {
    const hook = Cache.wipFiber.alternate ? updateWorkInProgressHook() : mountWorkInProgressHook();
    const oldDeps = hook.deps;
    const hasChanged = !deps || !oldDeps || deps.some((d, i) => !Object.is(d, oldDeps[i]));
    if (hasChanged) {
      hook.memoizedState = factory();
      hook.deps = deps;
    }
    return hook.memoizedState;
  }
  function useCallback(callback, deps) {
    return useMemo(() => callback, deps);
  }
  function useRef(initialValue) {
    const hook = Cache.wipFiber.alternate ? updateWorkInProgressHook() : mountWorkInProgressHook();
    if (hook.memoizedState === null) {
      hook.memoizedState = { current: initialValue };
    }
    return hook.memoizedState;
  }
  var REACT_CONTEXT_TYPE = Symbol.for("react.context");
  var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
  function createContext(defaultValue) {
    const context = {
      $$typeof: REACT_CONTEXT_TYPE,
      _defaultValue: defaultValue,
      _currentValue: defaultValue,
      Provider: null
    };
    context.Provider = {
      $$typeof: REACT_PROVIDER_TYPE,
      _context: context
    };
    return context;
  }
  function useContext(context) {
    debug("USE_CONTEXT")("useContext for:", context);
    return context._currentValue;
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
  function getAllInfiniteChainFiber(fiber, depth = 0, zDepth = 0) {
    if (!fiber) return;
    if (fiber.alternate) {
      if (zDepth > 15) {
        console.warn(
          `Infinite loop detected at depth ${zDepth} with fiber:`,
          fiber
        );
        throw new Error();
      }
      getAllInfiniteChainFiber(fiber.alternate, depth, zDepth + 1);
    }
    if (fiber.child) getAllInfiniteChainFiber(fiber.child, depth + 1, zDepth);
    if (fiber.sibling) getAllInfiniteChainFiber(fiber.sibling, depth, zDepth);
  }
  window.getAllInfiniteChainFiber = getAllInfiniteChainFiber;

  // src/react/h.js
  function h(type, props = {}, ...children) {
    props = props || {};
    const normalizedChildren = flatten(children).filter(
      (child) => child !== null && child !== void 0 && typeof child !== "boolean"
    ).map((child) => {
      return typeof child === "object" ? child : new VNode(NodeTagType.TEXT, { nodeValue: child, children: [] }, null);
    });
    return new VNode(
      type,
      { ...props, children: normalizedChildren },
      props.key || null
    );
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
        if (!node.child) {
          continue findSibling;
        }
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
  function getDomEventType(reactEventName) {
    const eventType = reactEventName.slice(2).toLowerCase();
    if (eventType === "change") {
      return "input";
    }
    return eventType;
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
    const vnode = typeof Cache.rootComponent === "function" ? h(Cache.rootComponent) : Cache.rootComponent;
    Cache.rootFiber.props = { children: [vnode] };
    Cache.deletions = [];
    Cache.nextUnitOfWork = Cache.rootFiber;
    ensureWorkLoop();
    debug("RENDER")("Render initialized:", Cache.rootFiber);
    window.rootFiber = Cache.rootFiber;
  }
  function performUnitOfWork(fiber) {
    debug("PERFORM_UNIT")("performUnitOfWork on:", fiber);
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
    debug("COMMIT_ROOT")("Commit Root \uC2DC\uC791");
    Cache.deletions.forEach(commitWork);
    commitWork(Cache.rootFiber.child);
    Cache.currentRoot = Cache.rootFiber;
    if (Cache.currentRoot) {
      Cache.currentRoot.alternate = null;
    }
    Cache.rootFiber = null;
    runEffects();
    debug("COMMIT_ROOT")("Commit \uC644\uB8CC, currentRoot set to:", Cache.currentRoot);
  }
  function beginWork(fiber) {
    debug("BEGIN_WORK")("beginWork:", fiber);
    switch (fiber.tag) {
      case NodeTagType.PROVIDER: {
        const context = fiber.type._context;
        const newPropsValue = fiber.props.value;
        const oldPropsValue = fiber.alternate ? fiber.alternate.props.value : context._defaultValue;
        if (changed(oldPropsValue, newPropsValue)) {
          fiber._contextHasChanged = true;
          Cache.forceRenderDescendantsCount++;
        }
        const prevValue = context._currentValue;
        Cache.contextStack.push(prevValue);
        context._currentValue = newPropsValue;
        debug("CONTEXT")(
          "Provider found. Value pushed:",
          newPropsValue,
          "Previous:",
          oldPropsValue
        );
        reconcileChildren(fiber, fiber.props.children);
        break;
      }
      case NodeTagType.TEXT: {
        if (fiber.effectTag === EffectType.PLACEMENT) {
          let text = fiber.props.nodeValue;
          if (text !== null && text !== void 0) {
            if (typeof text === "string") text = text.replace(/ /g, "\xA0");
            const textNode = document.createTextNode(text);
            fiber.stateNode = textNode;
          }
        }
        break;
      }
      case NodeTagType.COMPONENT: {
        try {
          const alternate = fiber.alternate;
          let hasPendingUpdates = false;
          if (alternate) {
            let oldHook = alternate.memoizedState;
            while (oldHook) {
              if (oldHook.queue && oldHook.queue.pending) {
                hasPendingUpdates = true;
                break;
              }
              oldHook = oldHook.next;
            }
          }
          if (alternate && !changed(fiber.props, alternate.props) && !hasPendingUpdates && Cache.forceRenderDescendantsCount === 0) {
            debug("BEGIN_WORK")(
              "Bailout: Cloning children for",
              fiber.componentName
            );
            fiber.memoizedState = alternate.memoizedState;
            let currentChild = alternate.child;
            if (currentChild) {
              let newChild = currentChild.clone();
              newChild.parent = fiber;
              fiber.child = newChild;
              let prevSibling = newChild;
              let nextCurrentChild = currentChild.sibling;
              while (nextCurrentChild) {
                let newSibling = nextCurrentChild.clone();
                newSibling.parent = fiber;
                prevSibling.sibling = newSibling;
                prevSibling = newSibling;
                nextCurrentChild = nextCurrentChild.sibling;
              }
            }
            break;
          }
          debug("BEGIN_WORK")("Component render for", fiber.componentName);
          prepareToRender(fiber);
          const children = fiber.type(fiber.props);
          reconcileChildren(
            fiber,
            Array.isArray(children) ? children : children ? [children] : []
          );
        } catch (error2) {
          debug("ERROR_BOUNDARY")("Caught error in", fiber.componentName, error2);
          let boundary = fiber.parent;
          while (boundary) {
            if (boundary.props && typeof boundary.props.renderFallback === "function") {
              debug("ERROR_BOUNDARY")("Found boundary:", boundary.componentName);
              boundary.hasError = true;
              boundary.error = error2;
              break;
            }
            boundary = boundary.parent;
          }
          if (!boundary) {
            throw error2;
          }
        }
        break;
      }
      case NodeTagType.HOST: {
        if (!fiber.stateNode) {
          debug("BEGIN_WORK")("Create host DOM:", fiber.type);
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
    debug("COMPLETE_WORK")("completeWork for:", fiber);
    if (fiber.tag === NodeTagType.PROVIDER) {
      if (fiber._contextHasChanged) {
        Cache.forceRenderDescendantsCount--;
        fiber._contextHasChanged = false;
      }
      const context = fiber.type._context;
      const prevValue = Cache.contextStack.pop();
      context._currentValue = prevValue;
      debug("CONTEXT")(
        "Provider complete. Value popped. Restored to:",
        prevValue
      );
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
    if (!parentDom) {
      error("COMMIT_WORK")("Cannot find parent DOM for placement:", fiber);
      return;
    }
    const beforeDom = findHostSiblingDom(fiber);
    debug("COMMIT_WORK")("Placement:", fiber, parentDom, beforeDom);
    insertOrAppendDom(fiber, beforeDom, parentDom);
  }
  function commitUpdate(fiber) {
    const target = fiber.stateNode;
    if (!target) return;
    if (fiber.tag !== NodeTagType.HOST && fiber.tag !== NodeTagType.TEXT) return;
    if (!(target instanceof Element) && !(target instanceof Text)) return;
    debug("COMMIT_WORK")(
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
    if (!fiber) return;
    debug("COMMIT_WORK")("Delete:", fiber);
    let child = fiber.child;
    while (child) {
      commitDelete(child);
      child = child.sibling;
    }
    let sibling = fiber.sibling;
    while (sibling) {
      commitDelete(sibling);
      sibling = sibling.sibling;
    }
    if (fiber.memoizedState) {
      let hook = fiber.memoizedState;
      while (hook) {
        if (hook.queue === void 0 && hook.deps !== void 0) {
          const effect = hook.memoizedState;
          if (effect && typeof effect.destroy === "function") {
            try {
              effect.destroy();
            } catch (e) {
              warn("LIFECYCLE")(
                "Error during cleanup in commitDelete:",
                e,
                "Fiber:",
                fiber
              );
            }
          }
        }
        hook = hook.next;
      }
    }
    if (fiber.props && fiber.props.ref && typeof fiber.props.ref === "object") {
      fiber.props.ref.current = null;
    }
    if (fiber.tag === NodeTagType.HOST || fiber.tag === NodeTagType.TEXT) {
      if (fiber.stateNode) {
        Object.keys(fiber.props || {}).filter(
          (k) => k.startsWith("on") && typeof fiber.props[k] === "function"
        ).forEach(
          (k) => fiber.stateNode.removeEventListener(
            getDomEventType(k),
            fiber.props[k]
          )
        );
        const parentDom = findHostParentDom(fiber);
        if (parentDom && fiber.stateNode.parentNode) {
          parentDom.removeChild(fiber.stateNode);
        } else if (parentDom && !fiber.stateNode.parentNode) {
          debug("COMMIT_WORK")(
            "Node already removed or parent mismatch:",
            fiber,
            parentDom
          );
        } else if (!parentDom) {
          warn("COMMIT_WORK")(
            "Parent DOM not found for deletion of:",
            fiber,
            "Current parentNode:",
            fiber.stateNode.parentNode
          );
        }
      }
    }
    if (fiber.alternate) {
      fiber.alternate.alternate = null;
    }
    fiber.parent = null;
    fiber.child = null;
    fiber.sibling = null;
    fiber.stateNode = null;
    fiber.alternate = null;
    fiber.memoizedState = null;
    fiber.props = null;
  }
  function applyProps(dom, props) {
    debug("APPLY_PROPS")("applyProps for:", dom, props);
    if (props.ref && typeof props.ref === "object") {
      props.ref.current = dom;
    }
    Object.keys(props).filter(
      (k) => k !== "children" && k !== "key" && k !== "nodeValue" && k !== "ref"
    ).forEach((name) => {
      if (name.startsWith("on") && typeof props[name] === "function") {
        const domEventType = getDomEventType(name);
        debug("APPLY_PROPS")(`addEventListener: ${domEventType}`);
        dom.addEventListener(domEventType, props[name]);
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
        const domEventType = getDomEventType(name);
        dom.removeEventListener(domEventType, prevProps[name]);
      }
    });
    if (prevProps.ref && prevProps.ref !== nextProps.ref) {
      prevProps.ref.current = null;
    }
    if (nextProps.ref && typeof nextProps.ref === "object") {
      nextProps.ref.current = dom;
    }
    Object.keys(prevProps).filter(
      (name) => name !== "children" && !name.startsWith("on") && name !== "ref"
    ).forEach((name) => {
      if (!(name in nextProps)) dom[name] = "";
    });
    Object.keys(nextProps).filter((name) => name !== "children" && name !== "ref").forEach((name) => {
      if (prevProps[name] === nextProps[name]) return;
      if (name.startsWith("on") && typeof nextProps[name] === "function") {
        const domEventType = getDomEventType(name);
        dom.addEventListener(domEventType, nextProps[name]);
      } else if (name === "className") {
        dom.className = nextProps[name];
      } else {
        applyProp(dom, name, nextProps[name]);
      }
    });
  }
  function reconcileChildren(wipFiber, vnodes) {
    debug("RECONCILE")("Reconciling children for:", wipFiber, vnodes);
    const existing = {};
    let oldFiber = wipFiber.alternate?.child;
    let index = 0;
    const keyCount = {};
    const explicitKeys = /* @__PURE__ */ new Set();
    vnodes.forEach((vnode) => {
      const key = vnode?.props?.key;
      if (key !== null && key !== void 0) {
        explicitKeys.add(key);
        keyCount[key] = (keyCount[key] || 0) + 1;
      }
    });
    Object.entries(keyCount).forEach(([key, count]) => {
      if (count > 1) {
        warn("RECONCILE")(
          `key "${key}"\uAC00 \uC790\uC2DD\uB4E4 \uC0AC\uC774\uC5D0\uC11C \uC911\uBCF5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`,
          wipFiber
        );
      }
    });
    while (oldFiber) {
      let key = oldFiber.key;
      if (key === null || key === void 0) {
        key = index;
        if (explicitKeys.has(key)) {
          key = `.${index}`;
        }
      }
      oldFiber.index = index;
      existing[key] = oldFiber;
      oldFiber = oldFiber.sibling;
      index++;
    }
    let newIndex = 0;
    let prevSibling = null;
    let lastPlacedIndex = 0;
    for (const vnode of vnodes) {
      let key = vnode.props.key;
      if (key === null || key === void 0) {
        key = newIndex;
        if (explicitKeys.has(key)) {
          key = `.${newIndex}`;
        }
      }
      const sameFiber = existing[key];
      let newFiber = null;
      if (sameFiber && vnode.type === sameFiber.type) {
        newFiber = sameFiber.clone();
        newFiber.props = vnode.props;
        newFiber.effectTag = EffectType.UPDATE;
        newFiber.index = newIndex;
        if (sameFiber.index < lastPlacedIndex) {
          newFiber.effectTag = EffectType.PLACEMENT;
        } else {
          lastPlacedIndex = sameFiber.index;
        }
        delete existing[key];
      } else if (vnode) {
        newFiber = new Fiber(vnode.type, vnode.props, key);
        newFiber.effectTag = EffectType.PLACEMENT;
        newFiber.index = newIndex;
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
    debug("WORK_LOOP")("workLoop tick");
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

  // src/react/router.js
  var RouterContext = createContext(null);
  function Router({ children }) {
    const [path, setPath] = useState(
      window.location.hash ? window.location.hash.substring(1) : "/"
    );
    const navigate = useCallback((to) => {
      debug("ROUTER")("Navigating to hash:", to);
      window.location.hash = to;
    }, []);
    useEffect(() => {
      const handleHashChange = () => {
        const newPath = window.location.hash ? window.location.hash.substring(1) : "/";
        debug("ROUTER")("hashchange event triggered. New path:", newPath);
        setPath(newPath);
      };
      window.addEventListener("hashchange", handleHashChange);
      return () => window.removeEventListener("hashchange", handleHashChange);
    }, []);
    const contextValue = useMemo(
      () => ({
        path,
        navigate
      }),
      [path, navigate]
    );
    return h(RouterContext.Provider, { value: contextValue }, ...children);
  }
  function Route({ path, component }) {
    const { path: currentPath } = useContext(RouterContext);
    if (currentPath === path) {
      return h(component, {});
    }
    return null;
  }
  function Link({ to, children }) {
    const { navigate } = useContext(RouterContext);
    const handleClick = (e) => {
      e.preventDefault();
      navigate(to);
    };
    return h("a", { href: `#${to}`, onClick: handleClick }, ...children);
  }
  function useNavigate() {
    const { navigate } = useContext(RouterContext);
    return navigate;
  }
  function useLocation() {
    const { path } = useContext(RouterContext);
    return { pathname: path };
  }
  return __toCommonJS(index_exports);
})();
