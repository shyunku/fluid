const { useState, useEffect, useMemo, render, h } = MiniReact;

const App = () => {
  return h(SubItem, {
    id: 0,
    key: 0,
    depth: 0,
    parentId: null,
    index: 0,
    indexEnd: 0,
    style: { marginLeft: "30px" },
    check: false,
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
    { className: "item", style: { marginLeft: `${20}px` } },
    h(
      "div",
      { className: "header" },
      h("div", { className: "id" }, "id: ", thisId),
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
      duration,
      "ms, Test String: here and here\r\n      "
    ),
    h(
      "div",
      { className: "item-list" },
      items.map((item, iind) =>
        h(SubItem, {
          ...item,
          key: `${thisId}.` + item.id,
          parentId: thisId,
          index: iind,
          indexEnd: items.length - 1,
          onItemMove: onItemMove,
        })
      )
    ),
    Array(5)
      .fill(null)
      .map((e, ind) => {
        return h("div", {}, ind);
      })
  );
};

render(App, document.getElementById("root"));
