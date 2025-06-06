import { Fiber, NodeTagType, EffectType, VNode } from "./types.js";
import { prepareToRender, runEffects } from "./hooks.js";
import { debug } from "./logger.js";
import { changed, changedLog, removeFromArray } from "./util.js";
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

  debug("RENDER", "Render initialized:", Cache.rootFiber);
  window.vroot = Cache.rootFiber;
}

/**
 * performUnitOfWork: 하나의 Fiber에 대해 beginWork → 자식 재귀 → completeWork를 수행합니다.
 * @param {Fiber} fiber
 * @returns {Fiber}
 */
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

/**
 * commitRoot: 모든 변경(삭제, 배치, 업데이트)을 DOM에 반영합니다.
 * @returns {void}
 */
function commitRoot() {
  debug("COMMIT_ROOT", "Commit Root 시작");
  Cache.deletions.forEach(commitWork);
  commitWork(Cache.rootFiber.child);

  Cache.currentRoot = Cache.rootFiber;
  Cache.rootFiber = null;

  runEffects();
  debug("COMMIT_ROOT", "Commit 완료, currentRoot set to:", Cache.currentRoot);
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
        !hasPendingUpdates
      ) {
        debug("BAILOUT", "Cloning children for:", fiber.componentName);

        let currentChild = alternate.child;
        if (!currentChild) {
          break; // No children to clone
        }

        let firstNewFiber = null;
        let prevNewFiber = null;

        while (currentChild) {
          const newFiber = new Fiber(
            currentChild.type,
            currentChild.props,
            currentChild.key
          );
          newFiber.stateNode = currentChild.stateNode;
          newFiber.alternate = currentChild;
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
  debug("COMPLETE_WORK", "completeWork for:", fiber);
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
    console.error("Cannot find parent DOM for placement:", fiber);
    return;
  }
  const beforeDom = findHostSiblingDom(fiber);

  debug("COMMIT_WORK", "Placement:", fiber, parentDom, beforeDom);
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

/**
 * commitDelete: DOM에 삭제를 수행합니다.
 * @param {Fiber} fiber
 * @param {HTMLElement} explicitParentDom
 * @returns {void}
 */
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

/**
 * applyProps: DOM에 이벤트 리스너 및 속성을 설정합니다.
 * @param {HTMLElement} dom
 * @param {Object} props
 * @returns {void}
 */
function applyProps(dom, props) {
  debug("APPLY_PROPS", "applyProps for:", dom, props);
  Object.keys(props)
    .filter((k) => k !== "children" && k !== "key" && k !== "nodeValue")
    .forEach((name) => {
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

  Object.keys(prevProps)
    .filter((name) => name !== "children" && !name.startsWith("on"))
    .forEach((name) => {
      if (!(name in nextProps)) dom[name] = "";
    });

  Object.keys(nextProps)
    .filter((name) => name !== "children")
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
 * @param {VNode[]} elements
 * @returns {void}
 */
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
