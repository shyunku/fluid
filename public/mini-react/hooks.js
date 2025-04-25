import { debug } from "./logger.js";

let wipFiber = null;
let hookIndex = 0;
let renderCallback = null;

export function prepareToRender(fiber) {
  wipFiber = fiber;
  wipFiber.hooks = [];
  hookIndex = 0;
}

export function useState(initial) {
  debug("USE_STATE", "useState initial:", initial);
  const oldHook = wipFiber.alternate?.hooks[hookIndex];
  const hook = { state: oldHook ? oldHook.state : initial, queue: [] };
  oldHook?.queue.forEach((action) => (hook.state = action(hook.state)));
  const setState = (action) => {
    debug("USE_STATE", "state update queued:", action);
    hook.queue.push(typeof action === "function" ? action : () => action);
    scheduleUpdate();
  };
  wipFiber.hooks[hookIndex] = hook;
  debug("USE_STATE", "hook stored at index", hookIndex, hook);
  hookIndex++;
  return [hook.state, setState];
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
