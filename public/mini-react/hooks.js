import { debug } from "./logger.js";

let wipFiber = null;
let hookIndex = 0;
let renderCallback = null;
const pendingEffects = [];

export function prepareToRender(fiber) {
  wipFiber = fiber;
  wipFiber.hooks = [];
  hookIndex = 0;
}

export function setRender(fn) {
  renderCallback = fn;
}

export function scheduleUpdate() {
  debug("SCHEDULE_UPDATE", "scheduleUpdate called");
  window.requestIdleCallback(() => {
    debug("SCHEDULE_UPDATE", "scheduleUpdate invoking renderCallback");
    renderCallback && renderCallback();
  });
}

/**
 * commitRoot에서 렌더가 완료된 후 호출
 */
export function runEffects() {
  // 이 함수는 core.js의 commitRoot 이후에 호출되어야 합니다.
  pendingEffects.forEach((fn) => fn());
  pendingEffects.length = 0;
}

export function useState(initial) {
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

export function useEffect(effect, deps) {
  const oldHook = wipFiber.alternate?.hooks[hookIndex];
  const hasChanged = oldHook
    ? !deps || deps.some((d, i) => !Object.is(d, oldHook.deps[i]))
    : true;
  const hook = {
    deps,
    cleanup: oldHook?.cleanup,
  };

  if (hasChanged) {
    // 이전 cleanup 호출
    if (hook.cleanup) {
      pendingEffects.push(() => hook.cleanup());
    }
    // 새로운 effect 추가
    pendingEffects.push(() => {
      const cleanupFn = effect();
      hook.cleanup = typeof cleanupFn === "function" ? cleanupFn : undefined;
    });
  }

  wipFiber.hooks[hookIndex] = hook;
  hookIndex++;
}

export function useMemo(factory, deps) {
  const oldHook = wipFiber.alternate?.hooks[hookIndex];
  const hasChanged = oldHook
    ? !deps || deps.some((d, i) => !Object.is(d, oldHook.deps[i]))
    : true;
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

export function useCallback(callback, deps) {
  // useMemo를 활용해 메모이제이션
  return useMemo(() => callback, deps);
}
