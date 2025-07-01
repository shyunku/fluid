// const {
//   useState,
//   useEffect,
//   useRef,
//   useMemo,
//   useCallback,
//   createContext,
//   useContext,
//   Router,
//   Route,
//   Link,
//   h,
//   render,
// } = MiniReact;

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

const App = () => {
  const [now, setNow] = useState(Date.now());
  const massiveRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 20);
    return () => clearInterval(interval);
  }, []);
  console.log("Render Home");

  return h(
    "div",
    {},
    h("h1", {}, "Home Page"),
    h("p", {}, `Current time: ${new Date(now).toLocaleTimeString()}`),
    h(
      "div",
      {},
      now,
      " ",
      massiveRef.current ? massiveRef.current.innerHTML : ""
    ),
    h(Massive, { massiveRef })
  );
};

const MassiveCount = 100;
const Massive = ({ massiveRef }) => {
  const [count, setCount] = useState(0);
  const items = useMemo(() => {
    return Array.from({ length: MassiveCount }, (_, i) =>
      h("div", {}, `Item ${i}`)
    );
  }, []);

  console.log("Render Massive", count);

  return h(
    "div",
    {},
    h("h2", { style: { marginLeft: "15px" } }, "Massive Component"),
    h(
      "button",
      { onClick: () => setCount((c) => c + 1), ref: massiveRef },
      `Increment Count: ${count}`
    ),
    h("div", {}, items)
  );
};

render(App, document.getElementById("root"));
