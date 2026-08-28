// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RejectionCards } from "./RejectionCards";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RejectionCards", () => {
  it("shows public rejection text and accepts the contributor's own rejection through its API", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ opinion: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const onRefresh = vi.fn(async () => {});
    render(
      <RejectionCards
        publicRejections={[{ authorName: "이규열", publicSummary: "교토 체류 연장", reason: "이동 시간이 부족합니다.", accepted: false }]}
        ownOpinions={[{ id: "11111111-1111-4111-8111-111111111111", targetDay: 1, body: "원문", status: "rejected", accepted: false }]}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText("교토 체류 연장")).toBeInTheDocument();
    expect(screen.getByText("미확인")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "반려 내용 확인" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/opinions/11111111-1111-4111-8111-111111111111/accept-rejection",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("반려 내용을 확인했습니다");
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
