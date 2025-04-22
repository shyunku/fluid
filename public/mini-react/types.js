export const NodeTagType = {
  HOST: "host",
  FUNCTION_COMPONENT: "function_component",
};

export const NodeType = {
  TEXT_ELEMENT: "text_element",
};

export const NodeConnectionType = {
  CHILD: "child",
  SIBLING: "sibling",
};

export class FiberNode {
  constructor(dom) {
    this.target = dom; // 실제 DOM 요소
    this.child = null; // 첫 번째 자식 FiberNode
    this.sibling = null; // 다음 형제 FiberNode
    this.parent = null; // 부모 FiberNode
    console.log("FiberNode created for:", dom);
  }

  connect(type, node) {
    console.log("FiberNode.connect", type, "node:", node.target);
    if (type === NodeConnectionType.CHILD) {
      node.parent = this;
      this.child = node;
    } else if (type === NodeConnectionType.SIBLING) {
      node.parent = this.parent;
      this.sibling = node;
    }
  }
}

export class Fiber {
  constructor(tag, type, props, key) {
    this.tag = tag; // HOST | FUNCTION_COMPONENT
    this.type = type; // 문자열 태그 또는 함수
    this.props = props; // props + children
    this.key = key;
    this.stateNode = null; // FiberNode 연결
    this.hooks = []; // useState 훅 저장소
    this.alternate = null; // 이전 렌더 트리 참조
    this.parent = null;
    this.child = null;
    this.sibling = null;
    this.effectTag = null;
    this.componentName =
      this.tag === NodeTagType.FUNCTION_COMPONENT ? type.name : null;
    console.log("Fiber created:", { tag, type, props, key });
  }
}
