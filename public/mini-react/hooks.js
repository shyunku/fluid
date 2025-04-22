let wipFiber = null;
let hookIndex = 0;
let renderCallback = null;

export function prepareToRender(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  console.log("prepareToRender for fiber:", fiber);
}

export function useState(initial) {
  console.log("useState initial:", initial);
  const oldHook = wipFiber.alternate?.hooks[hookIndex];
  const hook = { state: oldHook ? oldHook.state : initial, queue: [] };
  oldHook?.queue.forEach((action) => (hook.state = action(hook.state)));
  const setState = (action) => {
    console.log("state update queued:", action);
    hook.queue.push(typeof action === "function" ? action : () => action);
    scheduleUpdate();
  };
  wipFiber.hooks[hookIndex] = hook;
  console.log("hook stored at index", hookIndex, hook);
  hookIndex++;
  return [hook.state, setState];
}

export function setRender(fn) {
  renderCallback = fn;
  console.log("setRender called");
}

export function scheduleUpdate() {
  console.log("scheduleUpdate called");
  window.requestIdleCallback(() => {
    console.log("scheduleUpdate invoking renderCallback");
    renderCallback && renderCallback();
  });
}
