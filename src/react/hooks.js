import { debug } from "./logger.js";
import { workLoop } from "./core.js";
import { Cache } from "./cache.js";
import { Fiber } from "./types.js";

export function prepareToRender(fiber) {
  Cache.wipFiber = fiber;
  Cache.wipFiber.hooks = [];
  Cache.hookIndex = 0;
}

function flushUpdates() {
  // 마이크로태스크에서 한 번만 실행
  Cache.scheduled = false;

  if (!Cache.currentRoot) {
    return; // 업데이트할 대상이 없음
  }

  // `render` 함수와 유사하게 새로운 작업 루트를 설정합니다.
  // currentRoot를 alternate로 설정하여 diff를 준비합니다.
  const newRootFiber = new Fiber(null, Cache.currentRoot.props, null);
  newRootFiber.stateNode = Cache.currentRoot.stateNode;
  newRootFiber.alternate = Cache.currentRoot;

  Cache.rootFiber = newRootFiber;
  Cache.deletions = [];
  Cache.nextUnitOfWork = Cache.rootFiber;

  window.rootFiber = Cache.rootFiber;

  /* commitRoot 과정에서 nextUnitOfWork 가 생겼을 때 바로 workLoop 예약 */
  window.requestIdleCallback(workLoop); // 다음 idle 프레임 확보
}

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

export function useState(initialState) {
  return useReducer((state, action) => {
    return typeof action === "function" ? action(state) : action;
  }, initialState);
}

export function useReducer(reducer, initialState) {
  const oldHook = Cache.wipFiber.alternate?.hooks[Cache.hookIndex];
  const hook = oldHook || { state: initialState, queue: [] };

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

export function useCallback(callback, deps) {
  // useMemo를 활용해 메모이제이션
  return useMemo(() => callback, deps);
}

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

export function createContext(defaultValue) {
  const context = {
    $$typeof: REACT_CONTEXT_TYPE,
    _currentValue: defaultValue,
    Provider: null,
  };
  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  };
  return context;
}

export function useContext(context) {
  debug("USE_CONTEXT")("useContext for:", context);
  // 현재 컨텍스트 값을 읽어 반환합니다.
  // 값의 업데이트는 Provider의 value prop 변경과 리렌더링에 의해 처리됩니다.
  return context._currentValue;
}
