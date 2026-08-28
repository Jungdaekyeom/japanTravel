import { expect, test } from "@playwright/test";

test("desktop visitors see only the phone gate", async ({ page }) => {
  let apiRequests = 0;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/api/**", async (route) => {
    apiRequests += 1;
    await route.abort();
  });

  await page.goto("/t/e2e-invite-token");

  await expect(page.getByText("휴대폰에서 접속해 주세요")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "여행 일정" })).toHaveCount(0);
  expect(apiRequests).toBe(0);
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
  const response = await page.goto("/terms");
  expect(response?.headers()["referrer-policy"]).toBe("strict-origin");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  expect(response?.headers()["content-security-policy"]).toContain("https://maps.googleapis.com");
  expect(response?.headers()["content-security-policy"]).toContain("https://maps.gstatic.com");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const robots = await page.request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /");
});
