import { NodeTagType } from "./types.js";
import { flatten } from "./util.js";

export function h(type, props = {}, ...children) {
  props = props || {};
  const normalizedChildren = flatten(children)
    .filter((e) => e !== true && e !== false && e != null)
    .map((child) => {
      return typeof child === "object"
        ? child
        : {
            type: NodeTagType.TEXT,
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
