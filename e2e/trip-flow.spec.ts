import { expect, test, type Page } from "@playwright/test";

import { PUBLIC_TRIP_DEFINITION } from "../src/trip/public";
import { TRAVELERS } from "../src/trip/travelers";

async function installPublicTripApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && url.pathname === "/api/trip") {
      await route.fulfill({ json: { trip: PUBLIC_TRIP_DEFINITION, travelers: TRAVELERS, railRoutes: [] } });
      return;
    }
    throw new Error(`unexpected active API request: ${request.method()} ${url.pathname}`);
  });
}

test("keeps traveler panels private and plays every traveler's selected day together", async ({ page }) => {
  await installPublicTripApi(page);
  await page.goto("/");

  const opener = page.getByRole("button", { name: "일정 패널 열기" });
  await expect(page.getByRole("navigation", { name: "여행 일정" })).toHaveCount(0);
  await expect(opener).toBeVisible();
  await expect(page.getByRole("tablist", { name: "여행자 선택" })).toHaveCount(0);
  for (const name of ["정대겸", "이규열", "박준수", "한규준"]) {
    await expect(page.getByText(name)).toHaveCount(0);
  }
  await opener.click();
  await expect(page.getByRole("button", { name: "일정 패널 닫기" })).toBeFocused();
  await page.getByRole("button", { name: "일정 패널 닫기" }).click();
  await expect(opener).toBeVisible();
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(page.getByRole("button", { name: "일정 패널 닫기" })).toBeFocused();
  await page.getByRole("button", { name: /1일차/ }).click();
  await expect(page.getByRole("status")).toContainText("전원 · 1일차");
});

test("keeps the closed-panel opener clickable below a portrait stale-refresh alert", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let stale = false;
  await page.route("**/api/trip", async (route) => {
    if (stale) {
      await route.fulfill({ status: 503, json: { error: "unavailable" } });
      return;
    }
    await route.fulfill({ json: { trip: PUBLIC_TRIP_DEFINITION, travelers: TRAVELERS, railRoutes: [] } });
  });
  await page.goto("/");

  const opener = page.getByRole("button", { name: "일정 패널 열기" });
  await expect(opener).toBeVisible();
  stale = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const staleAlert = page.getByText("최신 데이터를 불러오지 못했습니다. 기존 일정을 표시합니다.", { exact: true });
  await expect(staleAlert).toHaveAttribute("role", "alert");

  await opener.click({ timeout: 1_000 });
  await expect(page.getByRole("button", { name: "일정 패널 닫기" })).toBeFocused();
});

test("old token URLs discard legacy join fragments when redirecting to the tokenless root", async ({ page }) => {
  await installPublicTripApi(page);
  await page.goto("/t/any-old-value#join=legacy-token");
  await expect(page).toHaveURL((url) =>
    url.pathname === "/" && url.search === "" && url.hash === "",
  );
});
