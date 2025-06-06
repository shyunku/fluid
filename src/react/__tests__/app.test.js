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

const $item = (id) => {
  const realId = id.replace(/\./g, "_");
  const item = document.querySelector(`div#item_${realId}`);
  if (!item) {
    throw new Error(`Item with id ${id} not found`);
  }
  return item;
};

const $upButton = (id) => {
  const item = $item(id);
  return item.querySelector(".header > button.up");
};

const $downButton = (id) => {
  const item = $item(id);
  return item.querySelector(".header > button.down");
};

const $addChildButton = (id) => {
  const item = $item(id);
  return item.querySelector(".header > button.add-child");
};

const $removeChildButton = (id) => {
  const item = $item(id);
  return item.querySelector(".header > button.remove");
};

const $child = (id, index) => {
  const item = $item(id);
  return item.querySelector(`.item-list > .item:nth-child(${index + 1})`);
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
    expect($item("0").innerHTML).toContain("id: 0");
    expect($addChildButton("0").textContent).toBe("child");
    // 초기에는 .item이 하나만 있어야 함
    expect($item("0").querySelectorAll(".item").length).toBe(0);
  });

  test("should create child when 'child' button is clicked", async () => {
    // 초기 상태 확인
    expect($item("0").querySelectorAll(".item").length).toBe(0);

    // 버튼 클릭 이벤트 시뮬레이션
    $addChildButton("0").click();

    // setState -> scheduleUpdate -> queueMicrotask(flushUpdates)
    // microtask가 실행될 때까지 기다림
    await flushMicrotasks();

    // 리렌더링 후 DOM 상태 확인
    expect($item("0").querySelectorAll(".item").length).toBe(1);
    expect($item("0").innerHTML).toContain("id: 0.1");
  });

  test("should create valid children when 'child' button is clicked multiple times", async () => {
    // 초기 상태 확인
    expect($item("0").querySelectorAll(".item").length).toBe(0);

    for (let i = 0; i < 10; i++) {
      $addChildButton("0").click();
      await flushMicrotasks();
    }

    expect($item("0.10")).not.toBeNull();
  });

  test("should create valid nested children", async () => {
    for (let i = 0; i < 10; i++) {
      $addChildButton("0" + ".1".repeat(i)).click();
      await flushMicrotasks();
    }

    expect($item("0" + ".1".repeat(10)).innerHTML).toContain(
      `id: ${"0" + ".1".repeat(10)}`
    );
  });

  test("should move child when 'down' button is clicked", async () => {
    // create 3 children
    for (let i = 0; i < 3; i++) {
      $addChildButton("0").click();
      await flushMicrotasks();
    }

    $downButton("0.3").click();
    await flushMicrotasks();

    expect($child("0", 0).innerHTML).toContain("id: 0.2");
    expect($child("0", 1).innerHTML).toContain("id: 0.3");
  });

  test("should move child that has children when 'down' button is clicked", async () => {
    for (let i = 0; i < 3; i++) {
      $addChildButton("0").click();
      await flushMicrotasks();
    }

    $addChildButton("0.3").click();
    await flushMicrotasks();

    $downButton("0.3").click();
    await flushMicrotasks();

    expect($child("0", 0).innerHTML).toContain("id: 0.2");
    expect($child("0", 1).innerHTML).toContain("id: 0.3.1");
  });

  test("should remove child when 'remove' button is clicked", async () => {
    for (let i = 0; i < 3; i++) {
      $addChildButton("0").click();
      await flushMicrotasks();
    }

    $removeChildButton("0.3").click();
    await flushMicrotasks();

    expect($child("0", 0).innerHTML).toContain("id: 0.2");
    expect($child("0", 1).innerHTML).toContain("id: 0.1");
  });

  test("should remove child and contain correct children", async () => {
    for (let i = 0; i < 3; i++) {
      $addChildButton("0").click();
      await flushMicrotasks();
    }
    $removeChildButton("0.1").click();
    await flushMicrotasks();

    expect($child("0", 0).innerHTML).toContain("id: 0.3");
    expect($child("0", 1).innerHTML).toContain("id: 0.2");

    $addChildButton("0").click();
    await flushMicrotasks();

    expect($child("0", 0).innerHTML).toContain("id: 0.4");
    expect($item("0").querySelectorAll(".item-list > .item").length).toBe(3);
  });
});
