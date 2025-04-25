import {
  Fiber,
  FiberNode,
  NodeTagType,
  NodeConnectionType,
  EffectType,
} from "./types.js";
import { h } from "./h.js";
import { prepareToRender, setRender } from "./hooks.js";

let currentApp = null;
let currentContainer = null;

let wipRoot = null; // 작업 중인(Fiber) 루트
let currentRoot = null; // 화면에 반영된(Fiber) 루트
let deletions = []; // 삭제될 Fiber 목록

export function render(element, container) {
  currentApp = element;
  currentContainer = container;

  setRender(() => render(currentApp, currentContainer));

  const vnode = typeof element === "function" ? element() : element;
  wipRoot = new Fiber(null, { children: [vnode] }, null);
  wipRoot.stateNode = new FiberNode(container);
  wipRoot.alternate = currentRoot;

  deletions = [];
  nextUnitOfWork = wipRoot; // 이후 requestIdleCallback 으로 작업 시작
}

function commitRoot() {
  console.log("Commit Root");
  deletions.forEach(commitWork); // 삭제부터 처리
  commitWork(wipRoot.child); // 배치·업데이트 처리
  currentRoot = wipRoot;
  wipRoot = null;
  console.log(currentRoot);
}

let nextUnitOfWork = null;
function workLoop(deadline) {
  while (nextUnitOfWork && deadline.timeRemaining() > 1) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }
  requestIdleCallback(workLoop);
}
requestIdleCallback(workLoop);

function performUnitOfWork(fiber) {
  beginWork(fiber);
  if (fiber.child) performUnitOfWork(fiber.child);
  completeWork(fiber);
  if (fiber.sibling) performUnitOfWork(fiber.sibling);
}

function beginWork(fiber) {
  console.log("beginWork", fiber);

  switch (fiber.tag) {
    case NodeTagType.TEXT:
      const textNode = document.createTextNode(fiber.props.nodeValue);
      fiber.stateNode = new FiberNode(textNode);
      break;
    case NodeTagType.COMPONENT:
      console.log("Function component execution for", fiber.componentName);
      prepareToRender(fiber);
      const element = fiber.type(fiber.props) || { props: { children: [] } };
      reconcileChildren(fiber, [element]);
      break;
    case NodeTagType.HOST:
      if (fiber.effectTag === EffectType.PLACEMENT) {
        console.log("Host component created");
        const dom = document.createElement(fiber.type);
        applyProps(dom, fiber.props);
        fiber.stateNode = new FiberNode(dom);
      } else {
        applyProps(fiber.stateNode.target, fiber.props);
      }
      reconcileChildren(fiber, fiber.props.children);
      break;
    case NodeTagType.ROOT:
      reconcileChildren(fiber, fiber.props.children);
      break;
  }
}

// Connect Stage
function completeWork(fiber) {
  console.log("completeWork for", fiber);
  if (!(fiber.stateNode instanceof FiberNode)) return;
  let parentFiber = fiber.parent;
  while (parentFiber && !(parentFiber.stateNode instanceof FiberNode)) {
    parentFiber = parentFiber.parent;
  }
  if (parentFiber) {
    const parentNode = parentFiber.stateNode;
    console.log("connect CHILD:", parentNode, fiber.stateNode);
    parentNode.connect(NodeConnectionType.CHILD, fiber.stateNode);
    let sib = parentNode.child;
    while (sib && sib.sibling) sib = sib.sibling;
    if (sib && sib !== fiber.stateNode) {
      console.log("connect SIBLING:", parentNode, fiber.stateNode);
      parentNode.connect(NodeConnectionType.SIBLING, fiber.stateNode);
    }
  }
}

function commitWork(fiber) {
  if (!fiber) return;
  const parentDom = findParentDom(fiber);

  if (fiber.effectTag === EffectType.PLACEMENT && fiber.stateNode) {
    console.log("Placement", fiber.stateNode.target, parentDom);
    parentDom.appendChild(fiber.stateNode.target);
  } else if (fiber.effectTag === EffectType.UPDATE && fiber.stateNode) {
    console.log(
      "Update",
      fiber,
      fiber.stateNode.target,
      fiber.alternate.props,
      fiber.props
    );
    updateDom(fiber.stateNode.target, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === EffectType.DELETE) {
    console.log("Delete", fiber);
    commitDeletion(fiber, parentDom);
    return;
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function applyProps(dom, props) {
  console.log("applyProps for", dom, props);
  Object.keys(props)
    .filter((k) => k !== "children" && k !== "key" && k !== "nodeValue")
    .forEach((name) => {
      if (name.startsWith("on") && typeof props[name] === "function") {
        const eventType = name.slice(2).toLowerCase();
        console.log(`addEventListener: ${eventType}`);
        dom.addEventListener(eventType, props[name]);
      } else if (name === "className") {
        dom.className = props[name];
      } else {
        dom[name] = props[name];
      }
    });
}

function updateDom(dom, prevProps, nextProps) {
  // 1. 이벤트 리스너 제거: prevProps에 있었는데 nextProps에 없거나 변경된 경우 제거
  Object.keys(prevProps)
    .filter((name) => name.startsWith("on"))
    .forEach((name) => {
      const eventType = name.slice(2).toLowerCase();
      if (!(name in nextProps) || prevProps[name] !== nextProps[name]) {
        dom.removeEventListener(eventType, prevProps[name]);
      }
    });

  // 2. 일반 속성 제거: prevProps에는 있지만 nextProps에는 없는 속성 제거
  Object.keys(prevProps)
    .filter((name) => name !== "children" && !name.startsWith("on"))
    .forEach((name) => {
      if (!(name in nextProps)) {
        dom[name] = "";
      }
    });

  // 3. 이벤트 리스너 추가 및 일반 속성 업데이트: nextProps에 있는 값 적용
  Object.keys(nextProps)
    .filter((name) => name !== "children")
    .forEach((name) => {
      if (name.startsWith("on")) {
        const eventType = name.slice(2).toLowerCase();
        // 이전과 다르거나 새로 추가된 이벤트 리스너 등록
        if (prevProps[name] !== nextProps[name]) {
          dom.addEventListener(eventType, nextProps[name]);
        }
      } else {
        dom[name] = nextProps[name];
      }
    });
}

function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate?.child;
  let prevSibling = null;

  while (index < elements.length || oldFiber) {
    const element = elements[index];
    let newFiber = null;
    const sameType = oldFiber && element && element.type === oldFiber.type;

    if (sameType) {
      // UPDATE
      newFiber = new Fiber(oldFiber.type, element.props, element.key);
      newFiber.stateNode = oldFiber.stateNode;
      newFiber.alternate = oldFiber;
      newFiber.effectTag = EffectType.UPDATE;
      console.log("update!!", newFiber.alternate, newFiber.stateNode);
    }
    if (!sameType && element) {
      // PLACEMENT
      newFiber = new Fiber(element.type, element.props, element.key);
      newFiber.effectTag = EffectType.PLACEMENT;
    }
    if (!sameType && oldFiber) {
      // DELETION
      oldFiber.effectTag = EffectType.DELETE;
      deletions.push(oldFiber);
    }

    if (oldFiber) oldFiber = oldFiber.sibling;
    if (index === 0) {
      wipFiber.child = newFiber;
      newFiber.parent = wipFiber;
    } else if (element) {
      prevSibling.sibling = newFiber;
      newFiber.parent = prevSibling.parent;
    }
    prevSibling = newFiber;
    index++;
  }
}

function findParentDom(fiber) {
  let parentFiber = fiber.parent;
  while (
    parentFiber &&
    parentFiber.tag !== NodeTagType.HOST &&
    parentFiber.tag !== NodeTagType.ROOT
  ) {
    parentFiber = parentFiber.parent;
  }
  return parentFiber ? parentFiber.stateNode.target : null;
}
