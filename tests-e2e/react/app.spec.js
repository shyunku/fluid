import { test, expect } from "@playwright/test";

test.describe("Mini-React E2E Test Bed", () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트가 실행되기 전에 E2E 테스트 페이지로 이동합니다.
    await page.goto("/tests-e2e/react/index.html");
  });

  test("should render initial layout correctly", async ({ page }) => {
    await expect(page.locator("h1")).toHaveText("Mini-React E2E Test Bed");
    await expect(page.locator(".card")).toHaveCount(4);
    await expect(page.locator("p").first()).toHaveText("Count: 0");
    await expect(page.locator("li")).toHaveCount(3);
    await expect(page.locator("li").first()).toContainText("Apple");
  });

  test("should toggle theme when 'Toggle Theme' button is clicked", async ({
    page,
  }) => {
    const themeButton = page.getByTestId("toggle-theme");
    await expect(themeButton).toContainText("Current: light");
    const initialStyle = await themeButton.getAttribute("style");

    await themeButton.click();
    await expect(themeButton).toContainText("Current: dark");
    const newStyle = await themeButton.getAttribute("style");
    expect(newStyle).not.toBe(initialStyle);

    await themeButton.click();
    await expect(themeButton).toContainText("Current: light");
    const finalStyle = await themeButton.getAttribute("style");
    expect(finalStyle).toBe(initialStyle);
  });

  test("should increment counter when 'Increment' button is clicked", async ({
    page,
  }) => {
    await page.getByTestId("increment").click();
    await expect(page.locator("p").first()).toHaveText("Count: 1");
  });

  test("should add an item to the list and focus input", async ({ page }) => {
    const input = page.locator("input");
    const addButton = page.getByTestId("add-item");

    await input.fill("Durian");
    await addButton.click();

    await expect(page.locator("li")).toHaveCount(4);
    await expect(page.locator("li").last()).toContainText("Durian");
    await expect(input).toHaveValue(""); // 입력창 초기화 확인
    await expect(input).toBeFocused(); // 항목 추가 후 포커스 확인
  });

  test("should remove an item from the list", async ({ page }) => {
    await expect(page.locator("li")).toHaveCount(3);

    await page.getByTestId("remove-Banana").click();

    await expect(page.locator("li")).toHaveCount(2);
    const texts = await page.locator("li").allTextContents();
    expect(texts.join("")).not.toContain("Banana");
    await expect(page.locator("li").first()).toContainText("Apple");
    await expect(page.locator("li").last()).toContainText("Cherry");
  });

  test("should reverse the list order", async ({ page }) => {
    await page.getByTestId("reverse-list").click();
    const items = page.locator("li");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("Cherry");
    await expect(items.nth(1)).toContainText("Banana");
    await expect(items.nth(2)).toContainText("Apple");
  });

  test("should focus the input when 'Focus Input' button is clicked", async ({
    page,
  }) => {
    const input = page.locator("input");
    await expect(input).not.toBeFocused();
    await page.getByTestId("focus-input").click();
    await expect(input).toBeFocused();
  });
});
