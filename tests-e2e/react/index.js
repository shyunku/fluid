// 번들된 MiniReact 라이브러리에서 필요한 함수들을 가져옵니다.
const {
  h,
  render,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  createContext,
  useContext,
} = window.MiniReact;

// 1. Context 생성
const ThemeContext = createContext("light");

// 2. Context를 사용하는 자식 컴포넌트
const ThemedButton = ({ children, ...props }) => {
  const theme = useContext(ThemeContext);
  const style =
    theme === "dark"
      ? "background-color: #333; color: #EEE;"
      : "background-color: #EEE; color: #333;";

  return h("button", { ...props, style }, children);
};

const TestBed = () => {
  const [theme, setTheme] = useState("light");
  const [count, setCount] = useState(0);
  const [items, setItems] = useState(["Apple", "Banana", "Cherry"]);
  const [text, setText] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    document.title = `You have ${items.length} items`;
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

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }, []);

  return h(
    ThemeContext.Provider,
    { value: theme },
    h(
      "div",
      { className: "test-container" },
      h("h1", {}, "Mini-React E2E Test Bed"),

      h(
        "div",
        { className: "card" },
        h("h2", {}, "useContext"),
        h(
          ThemedButton,
          { "data-testid": "toggle-theme", onClick: toggleTheme },
          `Toggle Theme (Current: ${theme})`
        )
      ),

      h(
        "div",
        { className: "card" },
        h("h2", {}, "useState & useCallback"),
        h("p", {}, `Count: ${count}`),
        h(
          ThemedButton,
          { "data-testid": "increment", onClick: () => setCount((c) => c + 1) },
          "Increment"
        )
      ),

      h(
        "div",
        { className: "card" },
        h("h2", {}, "useRef & DOM Interaction"),
        h(
          ThemedButton,
          { "data-testid": "focus-input", onClick: focusInput },
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
          oninput: (e) => setText(e.target.value),
          placeholder: "New item...",
        }),
        h(
          ThemedButton,
          { "data-testid": "add-item", onClick: handleAddItem },
          "Add Item"
        ),
        h(
          ThemedButton,
          { "data-testid": "reverse-list", onClick: handleReverseItems },
          "Reverse List"
        ),
        h("p", { style: "font-style: italic;" }, itemCountMessage),
        h(
          "ul",
          {},
          ...items.map((item) =>
            h(
              "li",
              { key: item },
              item,
              h(
                ThemedButton,
                {
                  "data-testid": `remove-${item}`,
                  onClick: () => handleRemoveItem(item),
                },
                "X"
              )
            )
          )
        )
      )
    )
  );
};

render(h(TestBed, {}), document.getElementById("root"));
