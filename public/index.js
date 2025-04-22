import { h } from "./mini-react/h.js";
import { render } from "./mini-react/core.js";
import { useState } from "./mini-react/hooks.js";

const App = () => {
  return h(SubItem, { id: 0, depth: 0, key: 0 });
};

// SubItem 컴포넌트 정의
const SubItem = ({ id, depth }) => {
  console.log("rerender!!!");
  const [items, setItems] = useState([]);

  const onItemClick = () => {
    setItems((items) => [
      { id: (items[0]?.id ?? -1) + 1, depth: depth + 1 },
      ...items,
    ]);
  };

  return h(
    "div",
    { className: "item", style: `margin-left: ${30 * depth}px` },
    h(
      "div",
      { className: "header" },
      h("div", { className: "id" }, `id: ${id}`),
      h("button", { onClick: onItemClick }, "click me")
    ),
    h(
      "div",
      { className: "item-list" },
      // 수정: 내부 map 호출 제거 및 각 항목에 대해 단일 SubItem 렌더링, 고유 key 부여
      items.map((item) =>
        h(
          "div",
          { className: "sub-item", key: item.id },
          h(SubItem, { ...item, key: item.id })
        )
      )
    )
  );
};
render(App, document.getElementById("root"));
