// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpinionComposer } from "./OpinionComposer";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OpinionComposer", () => {
  it("submits the selected day and opinion to the existing API, then refreshes", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ opinion: { id: "opinion-1" } }), { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    const onRefresh = vi.fn(async () => {});
    render(<OpinionComposer onRefresh={onRefresh} blocked={false} />);

    fireEvent.change(screen.getByRole("combobox", { name: "대상 일정" }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("textbox", { name: "의견" }), { target: { value: "하코네 시간을 늘려 주세요." } });
    fireEvent.click(screen.getByRole("button", { name: "의견 제출" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/opinions", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ targetDay: 2, body: "하코네 시간을 늘려 주세요." }),
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("의견을 보냈습니다");
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("disables submission until an unaccepted rejection is acknowledged", () => {
    render(<OpinionComposer onRefresh={vi.fn()} blocked />);

    expect(screen.getByRole("button", { name: "의견 제출" })).toBeDisabled();
    expect(screen.getByText("먼저 반려 내용을 확인해 주세요.")).toBeInTheDocument();
  });
});
