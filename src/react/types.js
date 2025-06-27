export const NodeTagType = {
  HOST: "host",
  HOST_ROOT: "host_root",
  TEXT: "text",
  COMPONENT: "component",
  PROVIDER: "provider",
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
  /**
   * 가상 노드를 생성합니다.
   * @param {string|function} type
   * @param {object} props
   * @param {string|number} key
   */
  constructor(type, props, key) {
    this.type = type;
    this.props = props;
    this.key = key;
  }
}

export class Fiber {
  /**
   * 파이버 노드를 생성합니다.
   * @param {string|function} type
   * @param {object} props
   * @param {string|number} key
   */
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
    this._contextHasChanged = false;
  }

  /**
   * 파이버의 태그를 계산합니다.
   * @param {string|function} type
   * @returns {string}
   */
  static calculateTag(type) {
    if (type === null) return NodeTagType.HOST_ROOT;
    if (type === NodeType.TEXT) return NodeTagType.TEXT;
    if (typeof type === "string") return NodeTagType.HOST;
    if (
      typeof type === "object" &&
      type !== null &&
      type.$$typeof === Symbol.for("react.provider")
    ) {
      return NodeTagType.PROVIDER;
    }
    return NodeTagType.COMPONENT;
  }

  /**
   * 파이버를 복제합니다.
   * @returns {Fiber}
   */
  clone() {
    const newFiber = new Fiber(this.type, this.props, this.key);
    newFiber.stateNode = this.stateNode;

    if (this.alternate) {
      this.alternate = null; // 이전 렌더 트리 참조를 해제합니다.
    }

    newFiber.alternate = this;
    newFiber.hooks = this.hooks;
    return newFiber;
  }
}
