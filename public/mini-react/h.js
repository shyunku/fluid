import { NodeType } from "./types.js";

export function h(type, props = {}, ...children) {
  props = props || {};
  const normalizedChildren = children.flat().map((child) => {
    return typeof child === "object"
      ? child
      : {
          type: NodeType.TEXT_ELEMENT,
          props: { nodeValue: child, children: [] },
          key: null,
        };
  });
  return {
    type,
    props: { ...props, children: normalizedChildren },
    key: props.key || null,
  };
}
