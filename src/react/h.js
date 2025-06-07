import { NodeTagType, VNode } from "./types.js";
import { flatten } from "./util.js";

/**
 * 가상 DOM 노드를 생성합니다. (JSX pragma)
 * @param {string|function} type
 * @param {object} props
 * @param  {...any} children
 * @returns {VNode}
 */
export function h(type, props = {}, ...children) {
  props = props || {};
  const normalizedChildren = flatten(children)
    .filter(Boolean)
    .map((child) => {
      return typeof child === "object"
        ? child
        : new VNode(NodeTagType.TEXT, { nodeValue: child, children: [] }, null);
    });

  return new VNode(
    type,
    { ...props, children: normalizedChildren },
    props.key || null
  );
}
