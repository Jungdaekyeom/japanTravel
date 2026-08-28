// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminReviewControls } from "./AdminReviewControls";

const opinion = {
  id: "22222222-2222-4222-8222-222222222222",
  participantId: "gyuyeol",
  authorName: "이규열",
  targetDay: 2 as const,
  body: "하코네에서 하루 더 머물고 싶어요.",
  status: "pending" as const,
  reviewedBy: null,
  reviewedAt: null,
  rejectionCategory: null,
  publicSummary: null,
  rejectionReason: null,
  rejectionAcceptedAt: null,
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AdminReviewControls", () => {
  it("approves a pending opinion through the existing admin API", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ opinion: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const onRefresh = vi.fn(async () => {});
    render(<AdminReviewControls opinions={[opinion]} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: "의견 승인" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/admin/opinions/22222222-2222-4222-8222-222222222222/approve",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("의견을 승인했습니다");
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("sends complete rejection fields through the existing admin API", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ opinion: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<AdminReviewControls opinions={[opinion]} onRefresh={vi.fn(async () => {})} />);

    fireEvent.change(screen.getByRole("combobox", { name: "반려 분류" }), { target: { value: "purpose_conflict" } });
    fireEvent.change(screen.getByRole("textbox", { name: "공개 요약" }), { target: { value: "하코네 체류 연장" } });
    fireEvent.change(screen.getByRole("textbox", { name: "반려 사유" }), { target: { value: "다음 숙박 예약과 맞지 않습니다." } });
    fireEvent.click(screen.getByRole("button", { name: "의견 반려" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/admin/opinions/22222222-2222-4222-8222-222222222222/reject",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ category: "purpose_conflict", publicSummary: "하코네 체류 연장", reason: "다음 숙박 예약과 맞지 않습니다." }),
      }),
    ));
  });

  it("surfaces a refresh failure after the mutation succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ opinion: {} }), { status: 200 })));
    render(<AdminReviewControls opinions={[opinion]} onRefresh={vi.fn(async () => { throw new Error("최신 검토 목록을 불러오지 못했습니다."); })} />);

    fireEvent.click(screen.getByRole("button", { name: "의견 승인" }));

    expect(await screen.findByRole("status")).toHaveTextContent("최신 검토 목록을 불러오지 못했습니다.");
  });
});
