import { h } from "../h.js";
import { render } from "../core.js";
import { useState, useEffect, useRef, useMemo, useCallback } from "../hooks.js";

const TestBed = () => {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState(["Apple", "Banana", "Cherry"]);
  const [text, setText] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    document.title = `You have ${items.length} items`;
    console.log(`[useEffect] Items updated:`, items);
  }, [items]);

  const handleAddItem = useCallback(() => {
    if (text.trim()) {
      setItems((prevItems) => [...prevItems, text.trim()]);
      setText("");
      inputRef.current?.focus();
    }
  }, [text]);

  const handleRemoveItem = useCallback((keyToRemove) => {
    setItems((prevItems) => prevItems.filter((item) => item !== keyToRemove));
  }, []);

  const handleReverseItems = useCallback(() => {
    setItems((prevItems) => [...prevItems].reverse());
  }, []);

  const itemCountMessage = useMemo(() => {
    return `There are ${items.length} items in the list.`;
  }, [items.length]);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return h(
    "div",
    { className: "test-container" },
    h("h1", {}, "Mini-React Test Bed"),

    h(
      "div",
      { className: "card" },
      h("h2", {}, "useState & useCallback"),
      h("p", {}, `Count: ${count}`),
      h(
        "button",
        { onClick: () => setCount((c) => c + 1), className: "increment" },
        "Increment"
      )
    ),

    h(
      "div",
      { className: "card" },
      h("h2", {}, "useRef & DOM Interaction"),
      h(
        "button",
        { onClick: focusInput, className: "focus-input" },
        "Click to Focus Input"
      )
    ),

    h(
      "div",
      { className: "card" },
      h("h2", {}, "List Management (Child CRUD & Keys)"),
      h("input", {
        ref: inputRef,
        value: text,
        onChange: (e) => setText(e.target.value),
        placeholder: "New item...",
      }),
      h(
        "button",
        { onClick: handleAddItem, className: "add-item" },
        "Add Item"
      ),
      h(
        "button",
        { onClick: handleReverseItems, className: "reverse-list" },
        "Reverse List"
      ),
      h("p", { style: "font-style: italic;" }, itemCountMessage),
      h(
        "ul",
        {},
        ...items.map((item) =>
          h(
            "li",
            { key: item }, // Use unique item name as key
            item,
            h(
              "button",
              {
                onClick: () => handleRemoveItem(item),
                style: "margin-left: 10px;",
              },
              "X"
            )
          )
        )
      )
    )
  );
};

render(h(TestBed, {}), document.getElementById("root"));
