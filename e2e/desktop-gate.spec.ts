import { expect, test } from "@playwright/test";

import { PUBLIC_TRIP_DEFINITION } from "../src/trip/public";
import { TRAVELERS } from "../src/trip/travelers";

test("wide fold-like screens show the trip without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 884, height: 1104 });
  await page.route("**/api/trip", async (route) => {
    await route.fulfill({ json: { trip: PUBLIC_TRIP_DEFINITION, travelers: TRAVELERS, railRoutes: [] } });
  });

  await page.goto("/");

  await expect(page.getByRole("button", { name: "일정 패널 열기" })).toBeVisible();
  await expect(page.getByText("휴대폰에서 접속해 주세요")).toHaveCount(0);
  expect(await page.locator("main").evaluate((main) => {
    const bounds = main.getBoundingClientRect();
    return { left: bounds.left, width: bounds.width, viewportWidth: window.innerWidth };
  })).toEqual({ left: 0, width: 884, viewportWidth: 884 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
});

test("legal pages stay available on desktop and link to Google policies", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  const termsResponse = await page.goto("/terms");
  expect(termsResponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "서비스 이용약관" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Google Maps Platform 서비스 약관" })).toHaveAttribute(
    "href",
    "https://cloud.google.com/maps-platform/terms/maps-service-terms",
  );

  const privacyResponse = await page.goto("/privacy");
  expect(privacyResponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "개인정보처리방침" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Google 개인정보처리방침" })).toHaveAttribute(
    "href",
    "https://policies.google.com/privacy",
  );
});

test("responses and metadata prevent indexing without blocking Google Maps", async ({ page }) => {
  await page.route("**/api/trip", async (route) => {
    await route.fulfill({ json: { trip: PUBLIC_TRIP_DEFINITION, travelers: TRAVELERS, railRoutes: [] } });
  });
  const response = await page.goto("/");
  const policy = response?.headers()["content-security-policy"] ?? "";
  expect(response?.headers()["referrer-policy"]).toBe("strict-origin");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  expect(policy.match(/default-src/g)).toHaveLength(1);
  expect(policy).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  expect(policy).toContain("https://*.googleapis.com");
  expect(policy).toContain("https://*.gstatic.com");
  expect(policy).toContain("*.google.com");
  expect(policy).toContain("https://*.ggpht.com");
  expect(policy).toContain("*.googleusercontent.com");
  expect(policy).toContain("frame-src *.google.com");
  expect(policy).toMatch(/connect-src [^;]*data: blob:/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const robots = await page.request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /");
});
