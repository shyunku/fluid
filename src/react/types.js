export const NodeTagType = {
  HOST: "host",
  HOST_ROOT: "host_root",
  TEXT: "text",
  COMPONENT: "component",
};

export const NodeType = {
  TEXT: "text",
};

export const EffectType = {
  PLACEMENT: "placement",
  UPDATE: "update",
  DELETE: "delete",
};

export class VNode {
  constructor(type, props, key) {
    this.type = type;
    this.props = props;
    this.key = key;
  }
}

export class Fiber {
  constructor(type, props, key) {
    this.tag = Fiber.calculateTag(type); // HOST | COMPONENT
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
    this.componentName = this.tag === NodeTagType.COMPONENT ? type.name : null;
    this.index = null;
  }

  static calculateTag(type) {
    if (type === null) return NodeTagType.HOST_ROOT;
    if (type === NodeType.TEXT) return NodeTagType.TEXT;
    if (typeof type === "string") return NodeTagType.HOST;
    return NodeTagType.COMPONENT;
  }

  clone() {
    const newFiber = new Fiber(this.type, this.props, this.key);
    newFiber.stateNode = this.stateNode;
    newFiber.alternate = this;
    newFiber.hooks = this.hooks;
    return newFiber;
  }
}
