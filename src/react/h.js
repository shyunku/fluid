import { NodeTagType, VNode } from "./types.js";
import { flatten } from "./util.js";

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
