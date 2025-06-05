import { debug } from "./logger.js";
import { workLoop } from "./core.js";
import { Cache } from "./cache.js";

export function prepareToRender(fiber) {
  Cache.wipFiber = fiber;
  Cache.wipFiber.hooks = [];
  Cache.hookIndex = 0;
}

function flushUpdates() {
  // 마이크로태스크에서 한 번만 실행
  Cache.scheduled = false;
  Cache.renderFunc(); // render() 가 rootFiber·nextUnit 설정
  /* commitRoot 과정에서 nextUnitOfWork 가 생겼을 때 바로 workLoop 예약 */
  window.requestIdleCallback(workLoop); // 다음 idle 프레임 확보
}

export function scheduleUpdate() {
  if (Cache.scheduled) return; // 중복 예약 방지
  Cache.scheduled = true;
  debug("SCHEDULE_UPDATE", "update batched");
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

export function useState(initial) {
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
