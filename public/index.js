import { h } from "./mini-react/h.js";
import { render } from "./mini-react/core.js";
import { useEffect, useMemo, useState } from "./mini-react/hooks.js";

const App = () => {
  const [rootIndex, setRootIndex] = useState(0);

  return h(SubItem, {
    id: `0`,
    index: rootIndex,
    indexEnd: 0,
    parentId: null,
    depth: 0,
    key: 0,
  });
};

// SubItem 컴포넌트 정의
const SubItem = ({
  id,
  parentId,
  index,
  indexEnd,
  onItemMove: onParentItemMove,
  depth,
}) => {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState("");
  const [duration, setDuration] = useState(0);
  const thisId = useMemo(
    () => `${parentId ? `${parentId}.` : ""}${id}`,
    [parentId, id]
  );
  const startTime = useMemo(() => Date.now(), []);

  const onItemClick = () => {
    setItems((items) => [{ id: items.length + 1, depth: depth + 1 }, ...items]);
  };

  const onItemMove = (index, offset) => {
    setItems((prevItems) => {
      const newItems = [...prevItems];
      const [movedItem] = newItems.splice(index, 1);
      const finalPos = Math.max(0, Math.min(newItems.length, index + offset));
      newItems.splice(finalPos, 0, movedItem);
      return newItems;
    });
  };

  useEffect(() => {
    // let t = setInterval(() => {
    //   setDuration(Date.now() - startTime);
    // }, 0);
    // return () => {
    //   clearInterval(t);
    // };
  }, []);

  return h(
    "div",
    {
      className: "item",
      style: `margin-left: ${20}px`,
      id: `item_${thisId?.replace(/\./g, "_") ?? "unknown"}`,
    },
    h(
      "div",
      { className: "header" },
      h("div", { className: "id" }, `id: ${thisId}`),
      h("button", { onClick: onItemClick }, "add child"),
      parentId != null &&
        index > 0 &&
        h("button", { onClick: (e) => onParentItemMove(index, -1) }, "up"),
      parentId != null &&
        index < indexEnd &&
        h("button", { onClick: (e) => onParentItemMove(index, 1) }, "down"),
      h("input", { onChange: (e) => setInput(e.target.value), value: input }),
      input,
      "/",
      duration + "ms"
    ),
    h(
      "div",
      { className: "item-list" },
      // 수정: 내부 map 호출 제거 및 각 항목에 대해 단일 SubItem 렌더링, 고유 key 부여
      items.map((item, iind) =>
        h(SubItem, {
          ...item,
          key: `${thisId}.` + item.id,
          parentId: thisId,
          index: iind,
          indexEnd: items.length - 1,
          onItemMove,
        })
      )
    )
  );
};
render(App, document.getElementById("root"));
