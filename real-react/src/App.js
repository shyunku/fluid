import React, { useState, useMemo, useEffect } from "react";

// SubItem 컴포넌트 정의
const SubItem = ({
  id,
  parentId,
  index,
  indexEnd,
  onItemMove: onParentItemMove,
  onItemRemove: onParentItemRemove,
  depth,
}) => {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState("");
  const [duration, setDuration] = useState(0);
  const thisId = useMemo(
    () => `${parentId !== null ? `${parentId}.` : ""}${id}`,
    [parentId, id]
  );
  const startTime = useMemo(() => Date.now(), []);

  useEffect(() => {
    let t = setInterval(() => {
      setDuration(Date.now() - startTime);
    }, 0);
    return () => {
      clearInterval(t);
    };
  }, []);

  const onItemAdd = () => {
    const itemMaxId = Math.max(...items.map((item) => item.id), 0) || 0;
    setItems((currentItems) => [
      { id: itemMaxId + 1, depth: depth + 1 },
      ...currentItems,
    ]);
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

  const onItemRemove = (index) => {
    setItems((prevItems) => {
      const newItems = [...prevItems];
      newItems.splice(index, 1);
      return newItems;
    });
  };

  return (
    <div
      className="item"
      style={{ marginLeft: `${depth > 0 ? 20 : 0}px` }}
      id={`item_${thisId?.replace(/\./g, "_") ?? "unknown"}`}
    >
      <div className="header">
        <div className="id">id: {thisId}</div>
        <button className="add-child" onClick={onItemAdd}>
          child
        </button>
        {parentId !== null && index > 0 && (
          <button className="up" onClick={() => onParentItemMove(index, -1)}>
            ▲
          </button>
        )}
        {parentId !== null && index < indexEnd && (
          <button className="down" onClick={() => onParentItemMove(index, 1)}>
            ▼
          </button>
        )}
        {parentId !== null && (
          <button className="remove" onClick={() => onParentItemRemove(index)}>
            X
          </button>
        )}
        <input onChange={(e) => setInput(e.target.value)} value={input} />
        {input}/{duration}ms
      </div>
      <div className="item-list">
        {items.map((item, iind) => (
          <SubItem
            {...item}
            key={`${thisId}.` + item.id}
            parentId={thisId}
            index={iind}
            indexEnd={items.length - 1}
            onItemMove={onItemMove}
            onItemRemove={onItemRemove}
          />
        ))}
      </div>
    </div>
  );
};

// App 컴포넌트 정의
const App = () => {
  const [rootIndex, setRootIndex] = useState(0);

  return (
    <div className="app">
      <h1>React Dev Test</h1>
      <SubItem
        id="0"
        index={rootIndex}
        indexEnd={0}
        parentId={null}
        depth={0}
        key={0}
      />
    </div>
  );
};

export default App;
