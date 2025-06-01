const { useState, useEffect, useMemo, render, h } = MiniReact;

export const App = () => {
  return (
    <SubItem
      id={0}
      key={0}
      depth={0}
      parentId={null}
      index={0}
      indexEnd={0}
      style={{ marginLeft: "30px" }}
      check={false}
    />
  );
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

  return (
    <div className="item" style={{ marginLeft: `${20}px` }}>
      <div className="header">
        <div className="id">id: {thisId}</div>
        <button onClick={onItemClick}>add child</button>
        {parentId != null && index > 0 && (
          <button onClick={(e) => onParentItemMove(index, -1)}>up</button>
        )}
        {parentId != null && index < indexEnd && (
          <button onClick={(e) => onParentItemMove(index, 1)}>down</button>
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
          />
        ))}
      </div>
    </div>
  );
};

render(App, document.getElementById("root"));
