import { Fiber, NodeTagType, EffectType, VNode } from "./types.js";
import { prepareToRender, runEffects } from "./hooks.js";
import { debug, warn, error } from "./logger.js";
import { changed } from "./util.js";
import {
  findHostParentDom,
  findHostSiblingDom,
  insertOrAppendDom,
} from "./domUtil.js";
import { Cache } from "./cache.js";

const requestIdleCallback =
  window.requestIdleCallback ||
  function (cb) {
    return requestAnimationFrame(() => cb({ timeRemaining: () => 1 }));
  };

initialize();

/**
 * 초기화
 * - requestIdleCallback 대체
 * - renderFunc 설정
 * - 초기 렌더링 예약
 */
function initialize() {
  Cache.renderFunc = render;
  requestIdleCallback(workLoop);
}

/**
 * render: 루트 요소를 받아 초기 Fiber 트리를 생성하고 작업을 시작합니다.
 * @param {Function | VNode} element
 * @param {HTMLElement} container
 * @returns {void}
 */
export function render(element, container) {
  Cache.rootComponent = element;
  Cache.rootTarget = container;

  Cache.renderFunc = () => render(Cache.rootComponent, Cache.rootTarget);

  Cache.rootFiber = new Fiber(null, {}, null);
  Cache.rootFiber.stateNode = Cache.rootTarget;
  Cache.rootFiber.alternate = Cache.currentRoot;

  prepareToRender(Cache.rootFiber);

  const vnode =
    typeof Cache.rootComponent === "function"
      ? Cache.rootComponent()
      : Cache.rootComponent;
  Cache.rootFiber.props = { children: [vnode] };

  Cache.deletions = [];
  Cache.nextUnitOfWork = Cache.rootFiber;
  ensureWorkLoop();

  debug("RENDER")("Render initialized:", Cache.rootFiber);
  window.rootFiber = Cache.rootFiber;
}

/**
 * performUnitOfWork: 하나의 Fiber에 대해 beginWork → 자식 재귀 → completeWork를 수행합니다.
 * @param {Fiber} fiber
 * @returns {Fiber}
 */
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

/**
 * commitRoot: 모든 변경(삭제, 배치, 업데이트)을 DOM에 반영합니다.
 * @returns {void}
 */
function commitRoot() {
  debug("COMMIT_ROOT")("Commit Root 시작");
  Cache.deletions.forEach(commitWork);
  commitWork(Cache.rootFiber.child);

  Cache.currentRoot = Cache.rootFiber;
  Cache.rootFiber = null;

  runEffects();
  debug("COMMIT_ROOT")("Commit 완료, currentRoot set to:", Cache.currentRoot);
}

/**
 * beginWork: Fiber 유형별로 처리합니다.
 * - TEXT: 텍스트 노드 생성
 * - COMPONENT: 함수형 컴포넌트 실행 후 reconcile
 * - HOST: DOM 생성 또는 업데이트 후 reconcile
 * - HOST_ROOT: 자식 reconcile
 * @param {Fiber} fiber
 * @returns {void}
 */
function beginWork(fiber) {
  debug("BEGIN_WORK")("beginWork:", fiber);
  // console.log(fiber);

  switch (fiber.tag) {
    case NodeTagType.PROVIDER: {
      const context = fiber.type._context;
      const value = fiber.props.value;

      const prevValue = context._currentValue;
      if (changed(prevValue, value)) {
        fiber._contextHasChanged = true;
        Cache.forceRenderDescendantsCount++;
      }
      Cache.contextStack.push(prevValue);
      context._currentValue = value;

      debug("CONTEXT")(
        "Provider found. Value pushed:",
        value,
        "Previous:",
        prevValue
      );

      reconcileChildren(fiber, fiber.props.children);
      break;
    }
    case NodeTagType.TEXT: {
      if (fiber.effectTag === EffectType.PLACEMENT) {
        const textNode = document.createTextNode(fiber.props.nodeValue);
        fiber.stateNode = textNode;
      }
      break;
    }
    case NodeTagType.COMPONENT: {
      try {
        const alternate = fiber.alternate;
        let hasPendingUpdates = false;
        if (alternate) {
          for (const hook of alternate.hooks) {
            if (hook.queue && hook.queue.length > 0) {
              hasPendingUpdates = true;
              break;
            }
          }
        }

        if (
          alternate &&
          !changed(fiber.props, alternate.props) &&
          !hasPendingUpdates &&
          Cache.forceRenderDescendantsCount === 0
        ) {
          debug("BEGIN_WORK")(
            "Bailout: Cloning children for",
            fiber.componentName
          );

          let currentChild = alternate.child;
          if (!currentChild) {
            break; // No children to clone
          }

          let firstNewFiber = null;
          let prevNewFiber = null;

          while (currentChild) {
            const newFiber = currentChild.clone();
            newFiber.parent = fiber;

            if (prevNewFiber === null) {
              firstNewFiber = newFiber;
            } else {
              prevNewFiber.sibling = newFiber;
            }
            prevNewFiber = newFiber;
            currentChild = currentChild.sibling;
          }

          fiber.child = firstNewFiber;
          break;
        }

        // console.log("update", fiber.componentName, fiber.props);

        debug("BEGIN_WORK")("Component render for", fiber.componentName);
        prepareToRender(fiber);
        const children = fiber.type(fiber.props);
        reconcileChildren(
          fiber,
          Array.isArray(children) ? children : children ? [children] : []
        );
      } catch (error) {
        debug("ERROR_BOUNDARY")("Caught error in", fiber.componentName, error);
        let boundary = fiber.parent;
        while (boundary) {
          if (
            boundary.props &&
            typeof boundary.props.renderFallback === "function"
          ) {
            debug("ERROR_BOUNDARY")("Found boundary:", boundary.componentName);
            boundary.hasError = true;
            boundary.error = error;
            break;
          }
          boundary = boundary.parent;
        }
        if (!boundary) {
          error("COMMIT_WORK")("Uncaught error:", error);
          throw error;
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
        // 이미 stateNode(DOM)는 있지만 PLACEMENT 태그가 붙은 경우 (예: 이동)
        // 이 경우에는 DOM을 새로 만들 필요는 없지만, applyProps는 필요할 수 있음 (이동 후 속성 변경 가정시)
        // 하지만 React 원칙상 이동은 props 변경없이 위치만 바뀌므로, applyProps는 업데이트에서 처리.
        // 여기서는 특별한 작업이 필요 없을 수 있음.
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

/**
 * completeWork: Fiber 간 연결(Child/Sibling)을 실제 FiberNode에 반영합니다.
 * @param {Fiber} fiber
 * @returns {void}
 */
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

/**
 * commitWork: effectTag에 따라 DOM에 배치·업데이트·삭제를 수행합니다.
 * @param {Fiber} fiber
 * @returns {void}
 */
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

/**
 * commitPlacement: DOM에 배치를 수행합니다.
 * @param {Fiber} fiber
 * @returns {void}
 */
function commitPlacement(fiber) {
  const parentDom = findHostParentDom(fiber);
  if (!parentDom) {
    error("COMMIT_WORK")("Cannot find parent DOM for placement:", fiber);
    return;
  }

  // 컴포넌트 파이버는 DOM 노드가 없으므로 건너뛰고,
  // commitWork의 재귀가 자식들을 처리하도록 합니다.
  // if (fiber.tag !== NodeTagType.HOST && fiber.tag !== NodeTagType.TEXT) {
  //   return;
  // }

  const beforeDom = findHostSiblingDom(fiber);

  debug("COMMIT_WORK")("Placement:", fiber, parentDom, beforeDom);
  insertOrAppendDom(fiber, beforeDom, parentDom);
}

/**
 * commitUpdate: DOM에 업데이트를 수행합니다.
 * @param {Fiber} fiber
 * @returns {void}
 */
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

/**
 * commitDelete: DOM에 삭제를 수행합니다.
 * @param {Fiber} fiber
 * @param {HTMLElement} explicitParentDom
 * @returns {void}
 */
function commitDelete(fiber, explicitParentDom = null) {
  debug("COMMIT_WORK")("Delete:", fiber);
  if (fiber.tag === NodeTagType.HOST || fiber.tag === NodeTagType.TEXT) {
    if (fiber.stateNode) {
      const parentDom = explicitParentDom || findHostParentDom(fiber);
      if (parentDom && fiber.stateNode.parentNode === parentDom) {
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

/**
 * applyProps: DOM에 이벤트 리스너 및 속성을 설정합니다.
 * @param {HTMLElement} dom
 * @param {Object} props
 * @returns {void}
 */
function applyProps(dom, props) {
  debug("APPLY_PROPS")("applyProps for:", dom, props);

  if (props.ref && typeof props.ref === "object") {
    props.ref.current = dom;
  }

  Object.keys(props)
    .filter(
      (k) => k !== "children" && k !== "key" && k !== "nodeValue" && k !== "ref"
    )
    .forEach((name) => {
      if (name.startsWith("on") && typeof props[name] === "function") {
        const eventType = name.slice(2).toLowerCase();
        debug("APPLY_PROPS")(`addEventListener: ${eventType}`);
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

/**
 * applyProp: DOM에 기타 속성을 상세하게 설정합니다.
 * @param {HTMLElement} dom
 * @param {string} name
 * @param {any} value
 * @returns {void}
 */
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

/**
 * updateDom: 이전/새 props를 비교해 이벤트 및 속성 변경사항을 반영합니다.
 * @param {HTMLElement} dom
 * @param {Object} prevProps
 * @param {Object} nextProps
 * @returns {void}
 */
function updateDom(dom, prevProps, nextProps) {
  Object.keys(prevProps)
    .filter((name) => name.startsWith("on"))
    .forEach((name) => {
      if (!(name in nextProps) || prevProps[name] !== nextProps[name]) {
        dom.removeEventListener(name.slice(2).toLowerCase(), prevProps[name]);
      }
    });

  // ref 갱신 처리
  if (prevProps.ref && prevProps.ref !== nextProps.ref) {
    prevProps.ref.current = null;
  }
  if (nextProps.ref && typeof nextProps.ref === "object") {
    nextProps.ref.current = dom;
  }

  Object.keys(prevProps)
    .filter(
      (name) => name !== "children" && !name.startsWith("on") && name !== "ref"
    )
    .forEach((name) => {
      if (!(name in nextProps)) dom[name] = "";
    });

  Object.keys(nextProps)
    .filter((name) => name !== "children" && name !== "ref")
    .forEach((name) => {
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

/**
 * reconcileChildren: key를 활용해 이전 Fiber와 매칭하고,
 * 타입/키가 같으면 업데이트, 새로 추가되거나 삭제가 필요한 노드를 처리합니다.
 * @param {Fiber} wipFiber
 * @param {VNode[]} vnodes
 * @returns {void}
 */
function reconcileChildren(wipFiber, vnodes) {
  debug("RECONCILE")("Reconciling children for:", wipFiber, vnodes);

  const existing = {};
  let oldFiber = wipFiber.alternate?.child;
  let index = 0;

  const keyCount = {};
  const explicitKeys = new Set();
  vnodes.forEach((vnode) => {
    const key = vnode?.props?.key;
    if (key !== null && key !== undefined) {
      explicitKeys.add(key);
      keyCount[key] = (keyCount[key] || 0) + 1;
    }
  });

  // 명시적 key 중복 체크 및 경고 출력
  Object.entries(keyCount).forEach(([key, count]) => {
    if (count > 1) {
      warn("RECONCILE")(
        `key "${key}"가 자식들 사이에서 중복되었습니다.`,
        wipFiber
      );
    }
  });

  while (oldFiber) {
    let key = oldFiber.key;
    if (key === null || key === undefined) {
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
    if (key === null || key === undefined) {
      key = newIndex;
      if (explicitKeys.has(key)) {
        key = `.${newIndex}`;
      }
    }
    const sameFiber = existing[key];
    let newFiber = null;

    if (sameFiber && vnode.type === sameFiber.type) {
      newFiber = sameFiber.clone();
      newFiber.props = vnode.props; // 새로운 props 적용
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

/**
 * shouldYield: 프레임 쪼개기
 * @param {number} start
 * @param {any} deadline
 * @returns {boolean}
 */
function shouldYield(start, deadline) {
  if (deadline) return deadline.timeRemaining() < 1;
  return performance.now() - start > 4;
}

/**
 * ensureWorkLoop: 작업 루프 보장
 * @returns {void}
 */
function ensureWorkLoop() {
  if (!Cache.workLoopScheduled) {
    Cache.workLoopScheduled = true;
    requestIdleCallback(workLoop);
  }
}

/**
 * workLoop: 유휴 시간에 performUnitOfWork를 반복 호출합니다.
 * @param {any} deadline
 * @returns {void}
 */
export function workLoop(deadline) {
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
