import {
  Fiber,
  FiberNode,
  NodeTagType,
  NodeType,
  NodeConnectionType,
} from "./types.js";
import { h } from "./h.js";
import { prepareToRender, setRender } from "./hooks.js";

let rootFiber = null;
let wipRoot = null; // 작업 중인(Fiber) 루트
let currentRoot = null; // 화면에 반영된(Fiber) 루트
let deletions = []; // 삭제될 Fiber 목록

export function render(element, container) {
  const vnode = typeof element === "function" ? element() : element;
  // 1) 컨테이너 노드를 타입으로 가지는 wrapping element 생성
  const rootElement = {
    type: container.nodeName.toLowerCase(),
    props: { children: [vnode] },
    key: null,
  };
  // 2) Fiber 인스턴스 생성
  wipRoot = createFiberFromElement(rootElement);
  wipRoot.stateNode = new FiberNode(container);
  wipRoot.alternate = currentRoot;
  deletions = [];
  nextUnitOfWork = wipRoot; // 이후 requestIdleCallback 으로 작업 시작
}

function commitRoot() {
  deletions.forEach(commitWork); // 삭제부터 처리
  commitWork(wipRoot.child); // 배치·업데이트 처리
  currentRoot = wipRoot;
  wipRoot = null;
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

function createFiberFromElement(element) {
  console.log("createFiberFromElement for", element);
  const tag =
    element.type === NodeType.TEXT_ELEMENT
      ? NodeType.TEXT_ELEMENT
      : typeof element.type === "string"
      ? NodeTagType.HOST
      : NodeTagType.FUNCTION_COMPONENT;
  const fiber = new Fiber(tag, element.type, element.props, element.key);
  return fiber;
}

function performUnitOfWork(fiber) {
  beginWork(fiber);
  if (fiber.child) performUnitOfWork(fiber.child);
  completeWork(fiber);
  if (fiber.sibling) performUnitOfWork(fiber.sibling);
}

function beginWork(fiber) {
  console.log("beginWork", fiber);
  if (fiber.tag === NodeType.TEXT_ELEMENT) {
    const textNode = document.createTextNode(fiber.props.nodeValue);
    fiber.stateNode = new FiberNode(textNode);
  } else if (fiber.tag === NodeTagType.FUNCTION_COMPONENT) {
    console.log("Function component execution for", fiber);
    prepareToRender(fiber);
    const element = fiber.type(fiber.props) || { props: { children: [] } };
    console.log("Function returned element:", element);
    // 최상위 반환 element 자체를 Fiber로 생성
    const childFiber = createFiberFromElement(element);
    childFiber.parent = fiber;
    fiber.child = childFiber;
  } else if (fiber.tag === NodeTagType.HOST) {
    console.log("Host component created");
    const dom = document.createElement(fiber.type);
    applyProps(dom, fiber.props);
    fiber.stateNode = new FiberNode(dom);
    // children 배열과 이전 Fiber 비교해서 배치·업데이트·삭제 태그 설정
    reconcileChildren(fiber, fiber.props.children);
  }
  // 텍스트 노드는 reconcile 생략
}

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

  if (fiber.effectTag === "PLACEMENT" && fiber.stateNode) {
    parentDom.appendChild(fiber.stateNode.target);
  } else if (fiber.effectTag === "UPDATE" && fiber.stateNode) {
    updateDom(fiber.stateNode.target, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === "DELETION") {
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
      newFiber = new Fiber(
        oldFiber.tag,
        oldFiber.type,
        element.props,
        element.key
      );
      newFiber.stateNode = oldFiber.stateNode;
      newFiber.alternate = oldFiber;
      newFiber.effectTag = "UPDATE";
    }
    if (!sameType && element) {
      // PLACEMENT
      newFiber = new Fiber(
        typeof element.type === "string"
          ? NodeTagType.HOST
          : NodeTagType.FUNCTION_COMPONENT,
        element.type,
        element.props,
        element.key
      );
      newFiber.effectTag = "PLACEMENT";
    }
    if (!sameType && oldFiber) {
      // DELETION
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }

    if (oldFiber) oldFiber = oldFiber.sibling;
    if (index === 0) wipFiber.child = newFiber;
    else if (element) prevSibling.sibling = newFiber;
    prevSibling = newFiber;
    index++;
  }
}

function findParentDom(fiber) {
  let parent = fiber.parent;
  // stateNode.target 이 실제 DOM 노드인 첫 번째 조상 Fiber를 찾음
  while (parent && !(parent.stateNode && parent.stateNode.target)) {
    parent = parent.parent;
  }
  // 일치하는 조상이 없으면 루트 컨테이너를 반환
  return parent
    ? parent.stateNode.target
    : wipRoot.stateNode.target;
}