// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RejectionCards } from "./RejectionCards";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RejectionCards", () => {
  it("does not render a rejection section without a pending personal rejection", () => {
    render(
      <RejectionCards
        onRefresh={vi.fn(async () => {})}
      />,
    );

    expect(screen.queryByRole("heading", { name: "최근 반려" })).not.toBeInTheDocument();
    expect(screen.queryByText("공개된 반려가 없습니다.")).not.toBeInTheDocument();
  });

  it("accepts the contributor's own pending rejection through its API", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ opinion: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const onRefresh = vi.fn(async () => {});
    render(
      <RejectionCards
        ownOpinions={[{ id: "11111111-1111-4111-8111-111111111111", targetDay: 1, body: "원문", status: "rejected", accepted: false }]}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "반려 내용 확인" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/opinions/11111111-1111-4111-8111-111111111111/accept-rejection",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("반려 내용을 확인했습니다");
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
