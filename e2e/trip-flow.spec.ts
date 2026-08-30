import { expect, test, type Page, type Route } from "@playwright/test";

import { PUBLIC_TRIP_DEFINITION } from "../src/trip/public";

const opinionId = "11111111-1111-4111-8111-111111111111";
const opinionBody = "하코네 온천 시간을 두 시간 늘리고 싶어요.";

type SessionRole = "observer" | "contributor" | "admin";
type ReviewStatus = "pending" | "rejected" | null;
const contributorToken = "c".repeat(43);
const contributorReissueToken = "r".repeat(43);
const adminToken = "a".repeat(43);

async function installApi(page: Page) {
  let role: SessionRole = "observer";
  let status: ReviewStatus = null;
  let accepted = false;
  let summary = "";
  let reason = "";

  function publicRejections() {
    return status === "rejected"
      ? [{ authorName: "박준수", publicSummary: summary, reason, accepted }]
      : [];
  }

  function payload() {
    const shared = {
      trip: PUBLIC_TRIP_DEFINITION,
      railRoutes: [],
      publicRejections: publicRejections(),
    };
    if (role === "contributor") {
      return {
        ...shared,
        role,
        displayName: "박준수",
        ownOpinions: status === null ? [] : [{ id: opinionId, targetDay: 2, body: opinionBody, status, accepted }],
      };
    }
    if (role === "admin") {
      return {
        ...shared,
        role,
        displayName: "정대겸",
        reviewQueue: status === null ? [] : [{
          id: opinionId,
          participantId: "junsu",
          authorName: "박준수",
          targetDay: 2,
          body: opinionBody,
          status,
          reviewedBy: status === "rejected" ? "daekyeom" : null,
          reviewedAt: status === "rejected" ? "2026-08-28T01:00:00.000Z" : null,
          rejectionCategory: status === "rejected" ? "schedule_impossible" : null,
          publicSummary: status === "rejected" ? summary : null,
          rejectionReason: status === "rejected" ? reason : null,
          rejectionAcceptedAt: accepted ? "2026-08-28T02:00:00.000Z" : null,
          createdAt: "2026-08-28T00:00:00.000Z",
          updatedAt: "2026-08-28T01:00:00.000Z",
        }],
      };
    }
    return { ...shared, role };
  }

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && url.pathname.startsWith("/api/trip/")) {
      await route.fulfill({ json: payload() });
      return;
    }
    if (request.method() === "POST" && url.pathname === "/api/session/claim") {
      const { token } = request.postDataJSON() as { token: string };
      role = token === adminToken ? "admin" : token === contributorToken || token === contributorReissueToken ? "contributor" : "observer";
      await route.fulfill({ status: role === "observer" ? 401 : 200, json: role === "observer" ? { error: "invalid_link" } : { role } });
      return;
    }
    if (request.method() === "DELETE" && url.pathname === "/api/session") {
      role = "observer";
      await route.fulfill({ status: 204 });
      return;
    }
    if (request.method() === "POST" && url.pathname === "/api/opinions") {
      const input = request.postDataJSON() as { targetDay: number | null; body: string };
      if (role !== "contributor" || input.targetDay !== 2 || input.body !== opinionBody) {
        await route.fulfill({ status: 400, json: { error: "unexpected_opinion" } });
        return;
      }
      status = "pending";
      await route.fulfill({ status: 201, json: { id: opinionId } });
      return;
    }
    if (request.method() === "POST" && url.pathname === `/api/admin/opinions/${opinionId}/reject`) {
      const input = request.postDataJSON() as { publicSummary: string; reason: string };
      summary = input.publicSummary;
      reason = input.reason;
      status = "rejected";
      await route.fulfill({ json: { id: opinionId, status } });
      return;
    }
    if (request.method() === "POST" && url.pathname === `/api/opinions/${opinionId}/accept-rejection`) {
      accepted = true;
      await route.fulfill({ json: { id: opinionId, accepted } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: "unhandled_test_request" } });
  });
}

async function claim(page: Page, token: string) {
  await page.goto(`/t/e2e-invite-token#join=${token}`);
  await expect(page).toHaveURL(/\/t\/e2e-invite-token$/);
}

test("observer, contributor, admin rejection, and author acceptance stay role-scoped", async ({ page }) => {
  await installApi(page);
  await page.goto("/t/e2e-invite-token");

  await expect(page.getByRole("navigation", { name: "여행 일정" })).toBeVisible();
  await expect(page.getByRole("button", { name: /일차/ })).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "의견 남기기" })).toHaveCount(0);

  await claim(page, contributorToken);
  await expect(page.getByText("박준수 · 개인 역할 활성")).toBeVisible();
  await page.getByLabel("대상 일정").selectOption("2");
  await page.getByLabel("의견", { exact: true }).fill(opinionBody);
  await page.getByRole("button", { name: "의견 제출" }).click();
  await expect(page.getByText("의견을 보냈습니다.")).toBeVisible();

  await page.getByRole("button", { name: "관찰자 모드로 전환" }).click();
  await claim(page, adminToken);
  await expect(page.getByRole("heading", { name: "의견 검토" })).toBeVisible();
  await expect(page.getByText(opinionBody)).toBeVisible();
  await page.getByLabel("반려 분류").selectOption("schedule_impossible");
  await page.getByLabel("공개 요약").fill("하코네 체류 연장");
  await page.getByLabel("반려 사유").fill("교토에서 오다와라로 이동하는 시간이 부족합니다.");
  await page.getByRole("button", { name: "의견 반려" }).click();
  await expect(page.getByText("검토할 의견이 없습니다.")).toBeVisible();

  await page.getByRole("button", { name: "관찰자 모드로 전환" }).click();
  await expect(page.getByRole("heading", { name: "하코네 체류 연장" })).toBeVisible();
  await expect(page.getByText("미확인")).toBeVisible();

  await claim(page, contributorReissueToken);
  await expect(page.getByRole("button", { name: "의견 제출" })).toBeDisabled();
  await page.getByRole("button", { name: "반려 내용 확인" }).click();
  await expect(page.getByText("확인함")).toBeVisible();
  await expect(page.getByRole("button", { name: "의견 제출" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "반려 내용 확인" })).toHaveCount(0);
});
