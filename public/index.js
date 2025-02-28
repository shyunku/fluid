const Index = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log("component mounted or updated: count:", count());
  }, [count()]);

  return h(
    "div",
    {},
    h("h1", {}, "react light!"),
    h("p", {}, `count: ${count()}`),
    h("button", { onClick: () => setCount((count) => count + 1) }, "increment"),
    h("button", { onClick: () => setCount((count) => count - 1) }, "decrement")
  );
};

registerRoot(Index);
