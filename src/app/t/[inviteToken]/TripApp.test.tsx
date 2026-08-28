// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRIP_DEFINITION } from "../../../trip/definition";
import { TripApp } from "./TripApp";

const { participants: _participants, ...trip } = TRIP_DEFINITION;

const observerPayload = { role: "observer" as const, trip, publicRejections: [] };
const contributorPayload = {
  role: "contributor" as const,
  trip,
  publicRejections: [
    { authorName: "이규열", publicSummary: "교토 체류 연장", reason: "다음 이동이 너무 늦어집니다.", accepted: false },
  ],
  ownOpinions: [
    { id: "11111111-1111-4111-8111-111111111111", targetDay: 1, body: "교토에 더 머물고 싶어요.", status: "rejected" as const, accepted: false },
  ],
};
const adminPayload = {
  role: "admin" as const,
  trip,
  publicRejections: [],
  reviewQueue: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      participantId: "gyuyeol",
      targetDay: 2,
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
    },
  ],
};

function media({ desktop = false, reduced = true } = {}) {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: query.includes("min-width") ? desktop : query.includes("prefers-reduced-motion") ? reduced : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

function mockFetch(payload: object) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  media();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TripApp", () => {
  it("shows only the phone notice at 768px and wider without fetching trip data", () => {
    media({ desktop: true });
    const fetch = mockFetch(observerPayload);

    render(<TripApp inviteToken="invite-123" />);

    expect(screen.getByText("휴대폰에서 접속해 주세요")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "여행 일정" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("starts with all five days in an open panel and unlock controls for an observer", async () => {
    mockFetch(observerPayload);

    render(<TripApp inviteToken="invite-123" />);

    expect(await screen.findByRole("navigation", { name: "여행 일정" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /일차/ })).toHaveLength(5);
    expect(screen.getByRole("textbox", { name: "개인 코드" })).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByRole("button", { name: "역할 잠금 해제" })).toBeInTheDocument();
  });

  it("closes the panel for 250ms, completes one reduced-motion playback, retains selection, and manages focus", async () => {
    vi.useFakeTimers();
    mockFetch(observerPayload);
    render(<TripApp inviteToken="invite-123" />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: /1일차/ }));
    expect(screen.getByRole("navigation", { name: "여행 일정" })).toHaveAttribute("data-state", "closing");

    await act(async () => vi.advanceTimersByTime(249));
    expect(screen.getByRole("navigation", { name: "여행 일정" })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1));

    const panelOpener = screen.getByRole("button", { name: "일정 패널 열기" });
    expect(screen.queryByRole("navigation", { name: "여행 일정" })).not.toBeInTheDocument();
    expect(panelOpener).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("1일차 경로 재생 완료");
    expect(screen.getByRole("button", { name: "1일차 경로 다시 재생" })).toBeInTheDocument();

    fireEvent.click(panelOpener);
    const selectedDay = screen.getByRole("button", { name: "1일차 간사이국제공항에서 교토" });
    expect(selectedDay).toHaveAttribute("aria-current", "true");
    expect(selectedDay).toHaveFocus();
  });

  it("cancels the previous selected route as soon as another day is chosen", async () => {
    vi.useFakeTimers();
    media({ reduced: false });
    mockFetch(observerPayload);
    render(<TripApp inviteToken="invite-123" />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: /1일차/ }));
    await act(async () => vi.advanceTimersByTime(250));
    fireEvent.click(screen.getByRole("button", { name: "일정 패널 열기" }));
    fireEvent.click(screen.getByRole("button", { name: /2일차/ }));

    expect(screen.getByRole("heading", { name: "전체 여행 일정" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "1일차 일정" })).not.toBeInTheDocument();
  });

  it("polls every 30 seconds while visible, refreshes on focus, and cleans up after unmount", async () => {
    vi.useFakeTimers();
    const fetch = mockFetch(observerPayload);
    const { unmount } = render(<TripApp inviteToken="invite-123" />);
    await act(async () => {});
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTime(30_000));
    expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.focus(window);
    await act(async () => {});
    expect(fetch).toHaveBeenCalledTimes(3);

    unmount();
    await act(async () => vi.advanceTimersByTime(60_000));
    fireEvent.focus(window);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("shows contributor opinion and rejection acceptance controls only for contributors", async () => {
    mockFetch(contributorPayload);
    render(<TripApp inviteToken="invite-123" />);

    expect(await screen.findByRole("heading", { name: "의견 남기기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "반려 내용 확인" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "의견 검토" })).not.toBeInTheDocument();
  });

  it("shows pending opinion review controls only for admins", async () => {
    mockFetch(adminPayload);
    render(<TripApp inviteToken="invite-123" />);

    expect(await screen.findByRole("heading", { name: "의견 검토" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "의견 승인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "의견 반려" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "의견 남기기" })).not.toBeInTheDocument();
  });
});
