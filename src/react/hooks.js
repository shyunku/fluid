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
  Cache.wipHook = null;
  Cache.currentHook = null;
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
  window.currentRoot = Cache.currentRoot;
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
  Cache.pendingEffects.forEach((effect) => {
    // 이전 effect의 cleanup 함수가 있다면 실행
    if (effect.destroy) {
      effect.destroy();
    }
    // 새로운 effect를 실행하고, cleanup 함수를 돌려받아 저장
    const cleanupFn = effect.create();
    if (typeof cleanupFn === "function") {
      effect.destroy = cleanupFn;
    }
  });
  Cache.pendingEffects.length = 0;
}

// 훅을 마운트/업데이트하는 헬퍼 함수
function mountWorkInProgressHook() {
  const hook = {
    memoizedState: null,
    queue: null,
    next: null,
  };

  if (Cache.wipHook === null) {
    Cache.wipFiber.memoizedState = Cache.wipHook = hook;
  } else {
    Cache.wipHook = Cache.wipHook.next = hook;
  }
  return Cache.wipHook;
}

// alternate(current) 파이버에서 대응하는 훅을 가져옵니다.
function updateWorkInProgressHook() {
  const oldHook = Cache.currentHook
    ? Cache.currentHook.next
    : Cache.wipFiber.alternate.memoizedState;
  Cache.currentHook = oldHook;

  const newHook = {
    memoizedState: oldHook.memoizedState,
    queue: oldHook.queue,
    next: null,
    deps: oldHook.deps,
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
  const hook = Cache.wipFiber.alternate
    ? updateWorkInProgressHook()
    : mountWorkInProgressHook();

  if (hook.queue === null) {
    // 마운트 시, 큐와 dispatch를 생성
    hook.memoizedState =
      typeof initialState === "function" ? initialState() : initialState;
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

/**
 * 부수 효과를 처리하기 위한 훅입니다.
 * @param {function(): (void|function(): void)} effect
 * @param {any[]} deps
 */
export function useEffect(create, deps) {
  const hook = Cache.wipFiber.alternate
    ? updateWorkInProgressHook()
    : mountWorkInProgressHook();
  const oldDeps = hook.deps;
  const hasChanged =
    !deps || !oldDeps || deps.some((d, i) => !Object.is(d, oldDeps[i]));

  if (hasChanged) {
    const newEffect = {
      create: create,
      destroy: hook.memoizedState ? hook.memoizedState.destroy : undefined, // 이전 effect의 destroy 함수를 가져옴
      deps: deps,
    };
    hook.memoizedState = newEffect;
    Cache.pendingEffects.push(newEffect);
  }
  hook.deps = deps;
}

/**
 * 메모이제이션된 값을 반환하는 훅입니다.
 * @param {function(): any} factory
 * @param {any[]} deps
 * @returns {*}
 */
export function useMemo(factory, deps) {
  const hook = Cache.wipFiber.alternate
    ? updateWorkInProgressHook()
    : mountWorkInProgressHook();
  const oldDeps = hook.deps; // useMemo는 별도 deps 프로퍼티 사용
  const hasChanged =
    !deps || !oldDeps || deps.some((d, i) => !Object.is(d, oldDeps[i]));

  if (hasChanged) {
    hook.memoizedState = factory();
    hook.deps = deps;
  }
  return hook.memoizedState;
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
  const hook = Cache.wipFiber.alternate
    ? updateWorkInProgressHook()
    : mountWorkInProgressHook();
  if (hook.memoizedState === null) {
    hook.memoizedState = { current: initialValue };
  }
  return hook.memoizedState;
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
