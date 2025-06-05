import {
  Fiber,
  FiberNode,
  NodeTagType,
  NodeConnectionType,
  EffectType,
} from "./types.js";
import { h } from "./h.js";
import { prepareToRender, runEffects } from "./hooks.js";
import { debug } from "./logger.js";
import { changed, changedLog, removeFromArray } from "./util.js";
import {
  findChildHostFiber,
  findHostParentDom,
  findHostSiblingDom,
  insertOrAppendDom,
} from "./domUtil.js";
import { Cache } from "./cache.js";

initialize();

/**
 * 초기화
 * - requestIdleCallback 대체
 * - renderFunc 설정
 * - 초기 렌더링 예약
 */
function initialize() {
  window.requestIdleCallback =
    window.requestIdleCallback ||
    function (cb) {
      return requestAnimationFrame(() => cb({ timeRemaining: () => 1 }));
    };
  Cache.renderFunc = render;
  requestIdleCallback(workLoop);
}

/**
 * render: 루트 요소를 받아 초기 Fiber 트리를 생성하고 작업을 시작합니다.
 */
export function render(
  component = Cache.rootComponent,
  container = Cache.rootTarget
) {
  if (!Cache.rootComponent && !Cache.rootTarget) {
    Cache.rootComponent = component;
    Cache.rootTarget = container;
  }

  // 최상위 Fiber 생성
  Cache.rootFiber = new Fiber(null, {}, null);
  Cache.rootFiber.stateNode = new FiberNode(container);
  Cache.rootFiber.alternate = Cache.currentRoot;

  prepareToRender(Cache.rootFiber);

  const vnode = typeof component === "function" ? component() : component;
  Cache.rootFiber.props = { children: [vnode] };

  Cache.deletions = [];
  Cache.nextUnitOfWork = Cache.rootFiber;
  ensureWorkLoop();

  debug("RENDER", "Render initialized:", Cache.rootFiber);
  window.vroot = Cache.rootFiber;
}

/**
 * performUnitOfWork: 하나의 Fiber에 대해 beginWork → 자식 재귀 → completeWork를 수행합니다.
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
 */
function commitRoot() {
  debug("COMMIT_ROOT", "Commit Root 시작");
  // 1) 삭제 처리
  Cache.deletions.forEach(commitWork);
  // 2) 배치·업데이트 처리
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
 */
function beginWork(fiber) {
  debug("BEGIN_WORK", "beginWork:", fiber);

  switch (fiber.tag) {
    case NodeTagType.TEXT: {
      if (fiber.effectTag === EffectType.PLACEMENT) {
        // 텍스트 노드 생성
        const textNode = document.createTextNode(fiber.props.nodeValue);
        fiber.stateNode = new FiberNode(textNode);
      }
      break;
    }
    case NodeTagType.COMPONENT: {
      debug("BEGIN_WORK", "Component render for", fiber.componentName);
      prepareToRender(fiber);
      const element = fiber.type(fiber.props) || { props: { children: [] } };
      reconcileChildren(fiber, [element]);
      break;
    }
    case NodeTagType.HOST: {
      // 마운트 vs 업데이트
      if (fiber.effectTag === EffectType.PLACEMENT) {
        debug("BEGIN_WORK", "Create host DOM:", fiber.type);
        const dom = document.createElement(fiber.type);

        applyProps(dom, fiber.props);
        fiber.stateNode = new FiberNode(dom);
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
 */
function completeWork(fiber) {
  debug("COMPLETE_WORK", "completeWork for:", fiber);
  if (!(fiber?.stateNode instanceof FiberNode)) return;

  let parentFiber = fiber.parent;
  while (parentFiber && !(parentFiber.stateNode instanceof FiberNode)) {
    parentFiber = parentFiber.parent;
  }
  if (!parentFiber) return;

  const parentNode = parentFiber.stateNode;
  // 자식 연결
  debug("COMPLETE_WORK", "connect CHILD:", parentNode, fiber.stateNode);
  parentNode.connect(NodeConnectionType.CHILD, fiber.stateNode);

  // 형제 연결
  let sib = parentNode.child;
  while (sib && sib.sibling) sib = sib.sibling;
  if (sib && sib !== fiber.stateNode) {
    debug("COMPLETE_WORK", "connect SIBLING:", parentNode, fiber.stateNode);
    parentNode.connect(NodeConnectionType.SIBLING, fiber.stateNode);
  }
}

/**
 * commitWork: effectTag에 따라 DOM에 배치·업데이트·삭제를 수행합니다.
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

function commitPlacement(fiber) {
  const parentDom = findHostParentDom(fiber);
  const beforeDom = findHostSiblingDom(fiber); // null 이면 append

  debug("COMMIT_WORK", "Placement:", fiber, parentDom, beforeDom);
  insertOrAppendDom(fiber, beforeDom, parentDom);
}

function commitUpdate(fiber) {
  const target = fiber.stateNode?.target;
  if (!target) return;
  debug(
    "COMMIT_WORK",
    "Update:",
    fiber,
    target,
    fiber.alternate.props,
    fiber.props
  );
  if (changed(fiber.alternate.props, fiber.props)) {
    // changedLog(fiber.alternate.props, fiber.props);
    updateDom(target, fiber.alternate.props, fiber.props);
  }
}

function commitDelete(fiber) {
  debug("COMMIT_WORK", "Delete:", fiber);
  const parentDom = findHostParentDom(fiber);
  commitDeletion(fiber, parentDom);
}

/**
 * applyProps: DOM에 이벤트 리스너 및 속성을 설정합니다.
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
 */
function updateDom(dom, prevProps, nextProps) {
  // 1) 이벤트 리스너 제거
  Object.keys(prevProps)
    .filter((name) => name.startsWith("on"))
    .forEach((name) => {
      if (!(name in nextProps) || prevProps[name] !== nextProps[name]) {
        dom.removeEventListener(name.slice(2).toLowerCase(), prevProps[name]);
      }
    });

  // 2) 속성 제거
  Object.keys(prevProps)
    .filter((name) => name !== "children" && !name.startsWith("on"))
    .forEach((name) => {
      if (!(name in nextProps)) dom[name] = "";
    });

  // 3) 이벤트 등록 및 속성 업데이트
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
 * commitDeletion: 해당 Fiber 및 자식들을 순회하며 DOM에서 제거합니다.
 */
function commitDeletion(fiber, parentDom) {
  if (!fiber) return;
  if (fiber.stateNode?.target) {
    parentDom.removeChild(fiber.stateNode.target);
  } else {
    commitDeletion(fiber.child, parentDom);
  }
}

/**
 * reconcileChildren: key를 활용해 이전 Fiber와 매칭하고,
 * 타입/키가 같으면 업데이트, 새로 추가되거나 삭제가 필요한 노드를 처리합니다.
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
    const sameFiber = existing[key]; // 같은 키를 가진 노드
    let newFiber = null;

    if (sameFiber && element.type === sameFiber.type) {
      // 업데이트
      newFiber = new Fiber(sameFiber.type, element.props, key);
      newFiber.stateNode = sameFiber.stateNode;
      newFiber.alternate = sameFiber;
      newFiber.effectTag = EffectType.UPDATE;
      newFiber.index = newIndex;

      if (sameFiber.index < lastPlacedIndex) {
        // 앞쪽에 이미 고정된 노드가 있으므로, 이 노드는 앞으로 '이동'해야 함
        newFiber.effectTag = EffectType.PLACEMENT;
      } else {
        lastPlacedIndex = sameFiber.index; // 오른쪽 끝 갱신
      }
      delete existing[key];
    } else if (element) {
      // 배치
      newFiber = new Fiber(element.type, element.props, key);
      newFiber.effectTag = EffectType.PLACEMENT;
    }

    if (sameFiber && !newFiber) {
      // 삭제
      sameFiber.effectTag = EffectType.DELETE;
      Cache.deletions.push(sameFiber);
    }

    if (newIndex === 0) {
      // child connection
      wipFiber.child = newFiber;
      if (newFiber) newFiber.parent = wipFiber;
    } else if (prevSibling && newFiber) {
      // sibling connection
      prevSibling.sibling = newFiber;
      newFiber.parent = wipFiber;
    }
    prevSibling = newFiber;
    newIndex++;
  }

  // 남은 oldFiber들은 삭제
  for (const key in existing) {
    const fiberToDelete = existing[key];
    fiberToDelete.effectTag = EffectType.DELETE;
    Cache.deletions.push(fiberToDelete);
  }
}

// 1) shouldYield 로 정확히 프레임을 쪼갬
function shouldYield(start, deadline) {
  // idleDeadline.timeRemaining()이 지원되는 브라우저 우선
  if (deadline) return deadline.timeRemaining() < 1;
  // fallback: 4ms 이상 점유 시 양보
  return performance.now() - start > 4;
}

function ensureWorkLoop() {
  if (!Cache.workLoopScheduled) {
    Cache.workLoopScheduled = true;
    requestIdleCallback(workLoop);
  }
}

/**
 * workLoop: 유휴 시간에 performUnitOfWork를 반복 호출합니다.
 */
export function workLoop(deadline) {
  Cache.workLoopScheduled = false;
  debug("WORK_LOOP", "workLoop tick");
  let start = performance.now();
  while (Cache.nextUnitOfWork && !shouldYield(start, deadline)) {
    Cache.nextUnitOfWork = performUnitOfWork(Cache.nextUnitOfWork);
  }

  if (Cache.nextUnitOfWork) {
    ensureWorkLoop(); // 잔여 작업이 있으면 다음 idle 시점에 계속 수행
  } else if (Cache.rootFiber) {
    commitRoot();
    if (Cache.nextUnitOfWork) {
      ensureWorkLoop(); // commitRoot 후에도 다음 작업이 있으면 계속
    }
  }
}
