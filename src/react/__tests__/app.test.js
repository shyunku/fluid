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

let activeElement;

// JSDOM focus/blur 기능 모킹
// `focus` 호출 시 `document.activeElement`를 설정하도록 모의 함수를 확장합니다.
Object.defineProperty(document, "activeElement", {
  get: () => activeElement,
});

const MOCK_FOCUS = jest.fn(function () {
  activeElement = this;
});
const MOCK_BLUR = jest.fn(function () {
  if (activeElement === this) {
    activeElement = document.body;
  }
});
window.HTMLElement.prototype.focus = MOCK_FOCUS;
window.HTMLElement.prototype.blur = MOCK_BLUR;

// DOM 쿼리 헬퍼
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// jest-dom의 toHaveFocus 등 matcher가 JSDOM에서 완벽하게 동작하지 않을 수 있어,
// document.activeElement를 직접 확인하는 헬퍼
const expectFocus = (element) => {
  expect(document.activeElement).toBe(element);
};

describe("Mini-React App Test", () => {
  beforeEach(() => {
    // Jest 모듈 캐시 리셋
    jest.resetModules();

    // JSDOM의 URL을 초기화 (기본 경로 '/')
    const initialUrl = "http://localhost/";
    delete window.location;
    window.location = new URL(initialUrl);

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
        contextStack: [],
      };
      if (key in defaultValue) {
        Cache[key] = Array.isArray(defaultValue[key])
          ? []
          : defaultValue[key] ?? null;
      }
    });

    // Mock 함수 초기화 및 activeElement 리셋
    MOCK_FOCUS.mockClear();
    MOCK_BLUR.mockClear();
    activeElement = document.body;

    // index.js 실행 (초기 렌더링)
    require("./index.js");
  });

  describe("Routing", () => {
    test("should render home page correctly on initial load", () => {
      expect($("h1").textContent.includes("Home")).toBe(true);
    });

    test("should navigate to About page when link is clicked", async () => {
      const aboutLink = Array.from($$("a")).find(
        (a) => a.textContent === "About"
      );
      aboutLink.click();
      await flushMicrotasks();
      expect($("h1").textContent.includes("About")).toBe(true);
    });

    test("should navigate back to Home page", async () => {
      const aboutLink = Array.from($$("a")).find(
        (a) => a.textContent === "About"
      );
      aboutLink.click();
      await flushMicrotasks();
      expect($("h1").textContent.includes("About")).toBe(true);

      const homeLink = Array.from($$("a")).find(
        (a) => a.textContent === "Home"
      );
      homeLink.click();
      await flushMicrotasks();
      expect($("h1").textContent.includes("Home")).toBe(true);
    });
  });

  describe("TestBed Component at /testbed", () => {
    beforeEach(async () => {
      const testBedLink = Array.from($$("a")).find((a) =>
        a.textContent.includes("Test")
      );
      testBedLink.click();
      await flushMicrotasks();
    });

    test("should render initial layout correctly", () => {
      expect($("h1").textContent.includes("Mini-React")).toBe(true);
      expect($$(".card").length).toBe(4);
      expect($("p").textContent.includes("0")).toBe(true);
      expect($$("li").length).toBe(3);
      expect($$("li")[0].textContent).toContain("Apple");
    });

    test("should toggle theme when 'Toggle Theme' button is clicked", async () => {
      const themeButton = $(".toggle-theme");
      const initialStyle = themeButton.style.backgroundColor;
      expect(themeButton.textContent).toContain("light");

      themeButton.click();
      await flushMicrotasks();

      const newStyle = themeButton.style.backgroundColor;
      expect(themeButton.textContent).toContain("dark");
      expect(newStyle).not.toBe(initialStyle);

      themeButton.click();
      await flushMicrotasks();

      const finalStyle = themeButton.style.backgroundColor;
      expect(themeButton.textContent).toContain("light");
      expect(finalStyle).toBe(initialStyle);
    });

    test("should increment counter when 'Increment' button is clicked", async () => {
      const incrementButton = $(".increment");
      incrementButton.click();
      await flushMicrotasks();
      expect($("p").textContent).toBe("Count: 1");
    });

    test("should add an item to the list and focus the input", async () => {
      const input = $("input");
      const addButton = $("button.add-item");

      input.value = "Durian";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flushMicrotasks();

      addButton.click();
      await flushMicrotasks();

      expect($$("li").length).toBe(4);
      expect($$("li")[3].textContent).toContain("Durian");
      expect(input.value).toBe("");
      expectFocus(input); // 포커스 확인
    });

    test("should remove an item from the list", async () => {
      const initialItems = $$("li");
      expect(initialItems.length).toBe(3);

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
      const input = $("input");
      focusButton.click();
      expectFocus(input);
    });
  });
});
