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

const HomePage = () => {
  const [now, setNow] = useState(Date.now());
  const massiveRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 200);
    return () => clearInterval(interval);
  }, []);
  console.log("Render");

  return h(
    "div",
    {},
    h("h1", {}, "Home Page"),
    h("p", {}, `Current time: ${new Date(now).toLocaleTimeString()}`),
    h("div", {}, now, massiveRef.current ? massiveRef.current.innerHTML : ""),
    h(Massive, { massiveRef })
  );
};

const MassiveCount = 10;
const Massive = ({ massiveRef }) => {
  const [count, setCount] = useState(0);
  const items = useMemo(() => {
    return Array.from({ length: MassiveCount }, (_, i) =>
      h("div", {}, `Item ${i}`)
    );
  }, []);

  return h(
    "div",
    {},
    h("h2", {}, "Massive Component"),
    h(
      "button",
      { onClick: () => setCount(count + 1), ref: massiveRef },
      `Increment Count: ${count}`
    ),
    h("div", {}, items)
  );
};

const AboutPage = () => h("div", {}, h("h1", {}, "About Page"));

const App = () => {
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
        h("span", { style: "margin: 0 10px;" }, "|")
      ),
      h("hr", {}),
      h(Route, { path: "/", component: HomePage }),
      h(Route, { path: "/about", component: AboutPage })
    )
  );
};

render(App, document.getElementById("root"));
