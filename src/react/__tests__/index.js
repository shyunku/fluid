import { h, render } from "../index.js";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  createContext,
  useContext,
  Router,
  Route,
  Link,
} from "../index.js";

// 1. Context 생성
const ThemeContext = createContext("light");

const App = () => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 20);
    return () => clearInterval(interval);
  }, []);

  return h(
    "div",
    {},
    h(
      Router,
      {},
      h(
        "nav",
        {},
        h(Link, { to: "/" }, "Home"),
        h("span", { style: "margin: 0 10px;" }, "|"),
        h(Link, { to: "/about" }, "About"),
        h("span", { style: "margin: 0 10px;" }, "|"),
        h(Link, { to: "/testbed" }, "Test Bed"),
        h("span", { style: "margin: 0 10px;" }, "|"),
        h("span", {}, `Current Time: ${now}`)
      ),
      h("hr", {}),
      h(Route, { path: "/", component: HomePage }),
      h(Route, { path: "/about", component: AboutPage }),
      h(Route, { path: "/testbed", component: TestBed })
    )
  );
};

const HomePage = () => h("div", {}, h("h1", {}, "Home Page"));
const AboutPage = () => h("div", {}, h("h1", {}, "About Page"));

const TestBed = () => {
  const [theme, setTheme] = useState("light");
  const [count, setCount] = useState(0);
  const [items, setItems] = useState(["Apple", "Banana", "Cherry"]);
  const [text, setText] = useState("");
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef(null);

  useEffect(() => {
    document.title = `You have ${items.length} items`;
    console.log(`[useEffect] Items updated:`, items);
  }, [items]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 20);
    return () => clearInterval(interval);
  }, []);

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
    // 3. Provider로 값 제공
    ThemeContext.Provider,
    { value: theme },
    h(
      "div",
      { className: "test-container" },
      h("h1", {}, "Mini-React Test         Bed"),

      h(
        "div",
        { className: "card" },
        h("h2", {}, "useContext"),
        h(
          ThemedButton,
          { onClick: toggleTheme, className: "toggle-theme" },
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
          { onClick: () => setCount((c) => c + 1), className: "increment" },
          "Increment"
        )
      ),

      h(
        "div",
        { className: "card" },
        h("h2", {}, "useRef & DOM Interaction", ` / ${now}`),
        h(
          ThemedButton,
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
          ThemedButton,
          { onClick: handleAddItem, className: "add-item" },
          "Add Item"
        ),
        h(
          ThemedButton,
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
                ThemedButton,
                {
                  onClick: () => handleRemoveItem(item),
                  className: "remove-item",
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

const ThemedButton = ({ children, ...props }) => {
  const theme = useContext(ThemeContext);
  const style =
    theme === "dark"
      ? "background-color: #333; color: #EEE;"
      : "background-color: #EEE; color: #333;";

  return h("button", { ...props, style }, children);
};

render(App, document.getElementById("root"));
