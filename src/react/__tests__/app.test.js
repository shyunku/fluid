import fs from "fs";
import path from "path";
import { Cache } from "../cache";

// queueMicrotask가 Jest 환경에서 비동기적으로 작동하므로,
// 이를 기다리기 위한 헬퍼 함수
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

// requestIdleCallback을 테스트용으로 동기화
global.requestIdleCallback = (callback) => {
  callback({ timeRemaining: () => Infinity });
  return 1;
};

describe("Mini-React Application Test", () => {
  // 각 테스트가 실행되기 전 환경 설정
  beforeEach(() => {
    // 1. Jest 모듈 캐시를 리셋하여 public/react/index.js가 매번 새로 실행되도록 함
    jest.resetModules();

    // 2. index.html 파일 내용을 읽어와 JSDOM에 설정
    const htmlPath = path.join(__dirname, "./index.html");
    const html = fs.readFileSync(htmlPath, "utf8");
    // <body> 태그 내부의 내용만 추출하여 설정
    document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];

    // 3. MiniReact의 내부 상태(Cache)를 초기화
    Object.keys(Cache).forEach((key) => {
      const defaultValue = {
        deletions: [],
        pendingEffects: [],
        workLoopScheduled: false,
        scheduled: false,
        hookIndex: 0,
      };
      Cache[key] = Array.isArray(defaultValue[key])
        ? []
        : defaultValue[key] ?? null;
    });

    // 4. public/react/index.js를 실행하여 초기 렌더링을 트리거
    require("./index.js");
  });

  test("should render initial components correctly", () => {
    const rootDiv = document.getElementById("root");
    expect(rootDiv.innerHTML).toContain("id: 0");
    expect(rootDiv.querySelector("button").textContent).toBe("add child");
    // 초기에는 .item이 하나만 있어야 함
    expect(rootDiv.querySelectorAll(".item").length).toBe(1);
  });

  test("should create child when 'add child' button is clicked", async () => {
    const rootDiv = document.getElementById("root");
    const addChildButton = rootDiv.querySelector("button");

    // 초기 상태 확인
    expect(rootDiv.querySelectorAll(".item").length).toBe(1);

    // 버튼 클릭 이벤트 시뮬레이션
    addChildButton.click();

    // setState -> scheduleUpdate -> queueMicrotask(flushUpdates)
    // microtask가 실행될 때까지 기다림
    await flushMicrotasks();

    // 리렌더링 후 DOM 상태 확인
    expect(rootDiv.querySelectorAll(".item").length).toBe(2);
    expect(rootDiv.innerHTML).toContain("id: 0.1");
  });

  test("should create valid children when 'add child' button is clicked multiple times", async () => {
    const rootDiv = document.getElementById("root");
    const addChildButton = rootDiv.querySelector("button");

    // 초기 상태 확인
    expect(rootDiv.querySelectorAll(".item").length).toBe(1);

    for (let i = 0; i < 10; i++) {
      addChildButton.click();
      await flushMicrotasks();
    }

    expect(rootDiv.querySelectorAll(".item").length).toBe(11);
  });

  test("should create valid nested children", async () => {
    const rootDiv = document.getElementById("root");

    const getFirstElementByDepth = (depth) => {
      const id = "0" + ".1".repeat(depth);
      const realId = id.replace(/\./g, "_");
      return rootDiv.querySelector(`#item_${realId}`);
    };

    for (let i = 0; i < 10; i++) {
      const nextButton =
        getFirstElementByDepth(i).querySelector("button.add-child");
      nextButton.click();
      await flushMicrotasks();
    }

    const lastChild = getFirstElementByDepth(10);

    expect(lastChild).toBeDefined();
    expect(lastChild.innerHTML).toContain(`id: ${"0" + ".1".repeat(10)}`);
  });

  test("should move child when 'down' button is clicked", async () => {
    const rootDiv = document.getElementById("root");

    // create 3 children
    const addChildButton = rootDiv.querySelector("button.add-child");
    for (let i = 0; i < 3; i++) {
      addChildButton.click();
      await flushMicrotasks();
    }

    const downButton = rootDiv.querySelector("div#item_0_3 button.down");
    downButton.click();
    await flushMicrotasks();

    // first child should be 0.2
    // get child by index
    expect(rootDiv.querySelector("div:nth-child(1)").innerHTML).toContain(
      "id: 0.2"
    );
  });

  test("should move child that has children when 'down' button is clicked", async () => {
    const rootDiv = document.getElementById("root");

    const addChildButton = rootDiv.querySelector("button.add-child");
    for (let i = 0; i < 3; i++) {
      addChildButton.click();
      await flushMicrotasks();
    }

    const addChildButton2 = rootDiv.querySelector(
      "div#item_0_3 button.add-child"
    );
    const downButton = rootDiv.querySelector("div#item_0_3 button.down");

    addChildButton2.click();
    await flushMicrotasks();

    downButton.click();
    await flushMicrotasks();

    expect(rootDiv.querySelector("div:nth-child(1)").innerHTML).toContain(
      "id: 0.2"
    );
    expect(rootDiv.querySelector("div:nth-child(2)").innerHTML).toContain(
      "id: 0.3.1"
    );
  });
});
