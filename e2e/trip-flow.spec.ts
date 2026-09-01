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

test("old token URLs discard legacy join fragments when redirecting to the tokenless root", async ({ page }) => {
  await installPublicTripApi(page);
  await page.goto("/t/any-old-value#join=legacy-token");
  await expect(page).toHaveURL((url) =>
    url.pathname === "/" && url.search === "" && url.hash === "",
  );
});
