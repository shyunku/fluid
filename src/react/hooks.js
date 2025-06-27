import { debug } from "./logger.js";
import { ensureWorkLoop, workLoop } from "./core.js";
import { Cache } from "./cache.js";
import { Fiber } from "./types.js";

/**
 * 렌더링을 위해 파이버를 준비합니다.
 * @param {Fiber} fiber
 */
export function prepareToRender(fiber) {
  Cache.wipFiber = fiber;
  Cache.wipFiber.hooks = [];
  Cache.hookIndex = 0;
}

/**
 * 업데이트를 스케줄링하고 마이크로태스크로 실행합니다.
 */
function flushUpdates() {
  // 마이크로태스크에서 한 번만 실행
  Cache.scheduled = false;

  if (!Cache.currentRoot) {
    return; // 업데이트할 대상이 없음
  }

  const newRootFiber = new Fiber(null, Cache.currentRoot.props, null);
  newRootFiber.stateNode = Cache.currentRoot.stateNode;
  newRootFiber.alternate = Cache.currentRoot;
  newRootFiber.alternate.alternate = null;

  Cache.rootFiber = newRootFiber;
  Cache.deletions = [];
  Cache.nextUnitOfWork = Cache.rootFiber;

  window.rootFiber = Cache.rootFiber;
  ensureWorkLoop();
  // window.requestIdleCallback(workLoop);
}

/**
 * 업데이트를 스케줄링합니다.
 */
export function scheduleUpdate() {
  if (Cache.scheduled) return; // 중복 예약 방지
  Cache.scheduled = true;
  debug("SCHEDULE_UPDATE")("update batched");
  queueMicrotask(flushUpdates); // 같은 tick 안의 setState 를 배칭
}

/**
 * commitRoot에서 렌더가 완료된 후 호출
 */
export function runEffects() {
  // 이 함수는 core.js의 commitRoot 이후에 호출되어야 합니다.
  Cache.pendingEffects.forEach((fn) => fn());
  Cache.pendingEffects.length = 0;
}

/**
 * 상태를 관리하기 위한 훅입니다.
 * @param {*} initialState
 * @returns {Array} - state와 dispatch 함수를 포함하는 배열
 */
export function useState(initialState) {
  return useReducer((state, action) => {
    return typeof action === "function" ? action(state) : action;
  }, initialState);
}

/**
 * 리듀서 함수를 사용하여 상태를 관리하는 훅입니다.
 * @param {function(any, any): any} reducer
 * @param {*} initialState
 * @returns {Array} - state와 dispatch 함수를 포함하는 배열
 */
export function useReducer(reducer, initialState) {
  const oldHook = Cache.wipFiber.alternate?.hooks[Cache.hookIndex];
  const hook = oldHook || {
    state: typeof initialState === "function" ? initialState() : initialState,
    queue: [],
  };

  hook.queue.forEach((action) => {
    hook.state = reducer(hook.state, action);
  });
  hook.queue = [];

  const dispatch = (action) => {
    hook.queue.push(action);
    scheduleUpdate();
  };

  Cache.wipFiber.hooks[Cache.hookIndex] = hook;
  Cache.hookIndex++;
  return [hook.state, dispatch];
}

/**
 * 부수 효과를 처리하기 위한 훅입니다.
 * @param {function(): (void|function(): void)} effect
 * @param {any[]} deps
 */
export function useEffect(effect, deps) {
  const oldHook = Cache.wipFiber.alternate?.hooks[Cache.hookIndex];
  const prevDeps = oldHook?.deps || [];
  const hasChanged = oldHook
    ? !deps || deps.some((d, i) => !Object.is(d, prevDeps[i]))
    : true;
  const hook = {
    deps,
    cleanup: oldHook?.cleanup,
  };

  if (hasChanged) {
    // 이전 cleanup 호출
    if (hook.cleanup) {
      Cache.pendingEffects.push(() => hook.cleanup());
    }
    // 새로운 effect 추가
    Cache.pendingEffects.push(() => {
      const cleanupFn = effect();
      hook.cleanup = typeof cleanupFn === "function" ? cleanupFn : undefined;
    });
  }

  Cache.wipFiber.hooks[Cache.hookIndex] = hook;
  Cache.hookIndex++;
}

/**
 * 메모이제이션된 값을 반환하는 훅입니다.
 * @param {function(): any} factory
 * @param {any[]} deps
 * @returns {*}
 */
export function useMemo(factory, deps) {
  const oldHook = Cache.wipFiber.alternate?.hooks[Cache.hookIndex];
  const hasChanged = oldHook
    ? !deps || deps.some((d, i) => !Object.is(d, oldHook.deps[i]))
    : true;
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

/**
 * 메모이제이션된 콜백을 반환하는 훅입니다.
 * @param {function(): any} callback
 * @param {any[]} deps
 * @returns {function(): any}
 */
export function useCallback(callback, deps) {
  // useMemo를 활용해 메모이제이션
  return useMemo(() => callback, deps);
}

/**
 * ref 객체를 반환하는 훅입니다.
 * @param {*} initialValue
 * @returns {{current: *}}
 */
export function useRef(initialValue) {
  debug("USE_REF")("useRef initial:", initialValue);
  const oldHook = Cache.wipFiber.alternate?.hooks[Cache.hookIndex];
  // 첫 렌더링 시에는 ref 객체를 생성하고, 이후에는 기존 객체를 재사용합니다.
  const hook = oldHook || { current: initialValue };

  Cache.wipFiber.hooks[Cache.hookIndex] = hook;
  debug("USE_REF")("hook stored at index", Cache.hookIndex, hook);
  Cache.hookIndex++;
  return hook;
}

const REACT_CONTEXT_TYPE = Symbol.for("react.context");
const REACT_PROVIDER_TYPE = Symbol.for("react.provider");

/**
 * 컨텍스트 객체를 생성합니다.
 * @param {*} defaultValue
 * @returns {{$$typeof: symbol, _currentValue: *, Provider: {$$typeof: symbol, _context: *}}}
 */
export function createContext(defaultValue) {
  const context = {
    $$typeof: REACT_CONTEXT_TYPE,
    _defaultValue: defaultValue,
    _currentValue: defaultValue,
    Provider: null,
  };
  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  };
  return context;
}

/**
 * 컨텍스트 값을 읽어오는 훅입니다.
 * @param {{_currentValue: *}} context
 * @returns {*}
 */
export function useContext(context) {
  debug("USE_CONTEXT")("useContext for:", context);
  // 현재 컨텍스트 값을 읽어 반환합니다.
  // 값의 업데이트는 Provider의 value prop 변경과 리렌더링에 의해 처리됩니다.
  return context._currentValue;
}
