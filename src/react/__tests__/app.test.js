import fs from "fs";
import path from "path";
import { Cache } from "../cache";

// microtask가 실행될 때까지 기다림
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

// requestIdleCallback을 테스트용으로 동기화
global.requestIdleCallback = (callback) => {
  callback({ timeRemaining: () => Infinity });
  return 1;
};

// JSDOM focus/blur 기능 모킹
const MOCK_FOCUS = jest.fn();
const MOCK_BLUR = jest.fn();
window.HTMLElement.prototype.focus = MOCK_FOCUS;
window.HTMLElement.prototype.blur = MOCK_BLUR;

// DOM 쿼리 헬퍼
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

describe("Mini-React Test Bed", () => {
  beforeEach(() => {
    // Jest 모듈 캐시 리셋
    jest.resetModules();

    // index.html 로드
    const htmlPath = path.join(__dirname, "./index.html");
    const html = fs.readFileSync(htmlPath, "utf8");
    document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];

    // MiniReact 캐시 초기화
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

    // Mock 함수 초기화
    MOCK_FOCUS.mockClear();
    MOCK_BLUR.mockClear();

    // index.js 실행 (초기 렌더링)
    require("./index.js");
  });

  test("should render initial layout correctly", () => {
    expect($("h1").textContent).toBe("Mini-React Test Bed");
    expect($$(".card").length).toBe(3);
    expect($("p").textContent).toBe("Count: 0");
    expect($$("li").length).toBe(3);
    expect($$("li")[0].textContent).toContain("Apple");
  });

  test("should increment counter when 'Increment' button is clicked", async () => {
    $("button.increment").click(); // 클래스 추가 필요
    await flushMicrotasks();
    expect($("p").textContent).toBe("Count: 1");
  });

  test("should add an item to the list", async () => {
    const input = $("input");
    const addButton = $("button.add-item");

    // Simulate user typing and trigger state update
    input.value = "Durian";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await flushMicrotasks(); // Wait for `setText` to re-render the component

    addButton.click();

    await flushMicrotasks(); // Wait for `setItems` to re-render the component

    expect($$("li").length).toBe(4);
    expect($$("li")[3].textContent).toContain("Durian");
    expect(input.value).toBe(""); // 입력창 초기화 확인
  });

  test("should remove an item from the list", async () => {
    const initialItems = $$("li");
    expect(initialItems.length).toBe(3);

    // 'Banana' 항목의 삭제 버튼 클릭
    const bananaRemoveButton = initialItems[1].querySelector("button");
    bananaRemoveButton.click();

    await flushMicrotasks();

    const currentItems = $$("li");
    expect(currentItems.length).toBe(2);
    expect(currentItems[0].textContent).toContain("Apple");
    expect(currentItems[1].textContent).toContain("Cherry");
  });

  test("should reverse the list order", async () => {
    const reverseButton = $("button.reverse-list");
    reverseButton.click();

    await flushMicrotasks();

    const items = $$("li");
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain("Cherry");
    expect(items[1].textContent).toContain("Banana");
    expect(items[2].textContent).toContain("Apple");
  });

  test("should focus the input when 'Focus Input' button is clicked", () => {
    const focusButton = $("button.focus-input");
    focusButton.click();
    expect(MOCK_FOCUS).toHaveBeenCalledTimes(1);
  });

  test("should focus input after adding an item", async () => {
    MOCK_FOCUS.mockClear();

    const input = $("input");
    const addButton = $("button.add-item");

    // Simulate user typing and trigger state update
    input.value = "New Fruit";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await flushMicrotasks(); // Wait for `setText` re-render

    addButton.click();

    await flushMicrotasks(); // Wait for `setItems` re-render

    // 항목 추가 후 포커스
    expect(MOCK_FOCUS).toHaveBeenCalledTimes(1);
  });
});
