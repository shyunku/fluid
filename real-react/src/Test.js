// App.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";

const MassiveCount = 10_000;

function Massive({ massiveRef }) {
  const [count, setCount] = useState(0);

  // 1만 개의 항목을 한 번만 생성
  const items = useMemo(
    () =>
      Array.from({ length: MassiveCount }, (_, i) => (
        <div key={i}>Item {i}</div>
      )),
    []
  );

  console.log("Render Massive", count);

  return (
    <div>
      <h2>Massive Component</h2>
      <button onClick={() => setCount((c) => c + 1)} ref={massiveRef}>
        Increment Count: {count}
      </button>
      <div>{items}</div>
    </div>
  );
}

export function Test() {
  const [now, setNow] = useState(Date.now());
  const massiveRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20);
    return () => clearInterval(id);
  }, []);

  console.log("Render Home");

  return (
    <div>
      <h1>Home Page</h1>
      <p>Current time: {new Date(now).toLocaleTimeString()}</p>
      <div>
        {now}
        {massiveRef.current ? massiveRef.current.innerHTML : ""}
      </div>
      <Massive massiveRef={massiveRef} />
    </div>
  );
}
