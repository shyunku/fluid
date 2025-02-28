const originalConsoleLog = console.log;
const logs = [];

function deCircularize(obj, cache = new WeakSet()) {
  if (!obj || typeof obj !== "object") return obj;
  if (cache.has(obj)) return "<circular object>";
  cache.add(obj);

  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in newObj) {
    newObj[key] = deCircularize(newObj[key], cache);
  }
  return newObj;
}

const stringify = (obj) => {
  let str = "";
  let type = typeof obj;
  if (Array.isArray(obj)) type = "array";
  switch (type) {
    case "array":
      str += "[";
      let values = [];
      for (let value of obj) values.push(value);
      for (let i = 0; i < values.length; i++) {
        str += stringify(values[i]);
        if (i < values.length - 1) str += ", ";
      }
      str += "]";
      return str;
    case "object":
      str += "{";
      let keys = [];
      for (let key in obj) keys.push(key);
      for (let i = 0; i < keys.length; i++) {
        str += `${keys[i]}: ${stringify(obj[keys[i]])}`;
        if (i < keys.length - 1) str += ", ";
      }
      str += "}";

      return str;
    case "string":
      return (str += `"${obj}"`);
    case "number":
      return (str += obj);
    default:
      return `<${typeof obj}/>`;
  }
};

const rerenderPre = () => {
  const pre = document.querySelector("pre");
  pre.innerHTML = "";
  for (let log of logs) {
    const cleanedLog = deCircularize(log);
    pre.append(`${stringify(cleanedLog)}\n`);
  }
};
const consoleLog = (...items) => {
  logs.push(items);
};
console.log = consoleLog;

const renderLoop = () => {
  rerenderPre();
  requestAnimationFrame(renderLoop);
};

window.addEventListener("DOMContentLoaded", () => {
  try {
    renderLoop();
  } catch (err) {
    alert(err.message);
  }
});
