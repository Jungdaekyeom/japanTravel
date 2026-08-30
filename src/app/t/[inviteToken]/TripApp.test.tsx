// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_TRIP_DEFINITION } from "../../../trip/public";
import { TripApp } from "./TripApp";

const trip = PUBLIC_TRIP_DEFINITION;

const observerPayload = { role: "observer" as const, trip, railRoutes: [], publicRejections: [] };
const contributorPayload = {
  role: "contributor" as const,
  displayName: "이규열",
  trip,
  railRoutes: [],
  publicRejections: [
    { authorName: "이규열", publicSummary: "교토 체류 연장", reason: "다음 이동이 너무 늦어집니다.", accepted: false },
  ],
  ownOpinions: [
    { id: "11111111-1111-4111-8111-111111111111", targetDay: 1, body: "교토에 더 머물고 싶어요.", status: "rejected" as const, accepted: false },
  ],
};
const adminPayload = {
  role: "admin" as const,
  displayName: "정대겸",
  trip,
  railRoutes: [],
  publicRejections: [],
  reviewQueue: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      participantId: "gyuyeol",
      authorName: "이규열",
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

function json(payload: object, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

beforeEach(() => {
  media();
  window.history.replaceState(null, "", "/");
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

  it("starts with all five days and no manual unlock controls for an observer", async () => {
    mockFetch(observerPayload);

    render(<TripApp inviteToken="invite-123" />);

    expect(await screen.findByRole("navigation", { name: "여행 일정" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /일차/ })).toHaveLength(5);
    expect(within(screen.getByRole("navigation", { name: "여행 일정" })).getByText("부산·인천에서 KIX 도착 후 JR 하루카로 교토역 이동, 교토 명소 방문")).toBeVisible();
    expect(within(screen.getByRole("navigation", { name: "여행 일정" })).getByRole("button", { name: "1일차 간사이국제공항에서 교토역. 부산·인천에서 KIX 도착 후 JR 하루카로 교토역 이동, 교토 명소 방문" })).toBeInTheDocument();
    expect(screen.getByText("공개 일정만 보기")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "역할 잠금 해제" })).not.toBeInTheDocument();
  });

  it("posts a fragment join token in JSON, scrubs the URL, and refreshes the claimed role", async () => {
    const token = "a".repeat(43);
    window.history.replaceState(null, "", `/t/invite-123#join=${token}`);
    let claimed = false;
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/session/claim") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ token });
        claimed = true;
        return json({ role: "contributor" });
      }
      if (url.includes("/api/trip/")) return json(claimed ? contributorPayload : observerPayload);
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(<TripApp inviteToken="invite-123" />);

    expect(await screen.findByRole("heading", { name: "의견 남기기" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/t/invite-123");
    expect(window.location.hash).toBe("");
    expect(fetch.mock.calls.some(([input]) => String(input).includes(token))).toBe(false);
  });

  it("scrubs a failed personal-link fragment and tells the user to reopen it", async () => {
    const token = "r".repeat(43);
    window.history.replaceState(null, "", `/t/invite-123#join=${token}`);
    let claimCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/session/claim") {
        claimCalls += 1;
        return json({ error: "service_unavailable" }, 503);
      }
      if (url.includes("/api/trip/")) return json(observerPayload);
      throw new Error(`unexpected request: ${url}`);
    }));

    render(<TripApp inviteToken="invite-123" />);

    await screen.findByText("공개 일정만 보기");
    await waitFor(() => expect(claimCalls).toBe(1));
    expect(window.location.hash).toBe("");
    expect(screen.getByText("개인 링크를 확인하지 못했습니다. 카카오톡 링크를 다시 열어주세요.")).toHaveAttribute("role", "alert");
  });

  it("claims a personal link opened as a same-document fragment navigation", async () => {
    const token = "h".repeat(43);
    let claimed = false;
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/session/claim") {
        expect(JSON.parse(String(init?.body))).toEqual({ token });
        claimed = true;
        return json({ role: "contributor" });
      }
      if (url.includes("/api/trip/")) return json(claimed ? contributorPayload : observerPayload);
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    render(<TripApp inviteToken="invite-123" />);
    await screen.findByText("공개 일정만 보기");

    window.location.hash = `join=${token}`;
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(await screen.findByRole("heading", { name: "의견 남기기" })).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  it("closes the panel for 250ms, completes one playback, retains selection, and manages focus", async () => {
    vi.useFakeTimers();
    media({ reduced: false });
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
    const selectedDay = within(screen.getByRole("navigation", { name: "여행 일정" })).getByRole("button", { name: /^1일차 / });
    expect(selectedDay).toHaveAttribute("aria-current", "true");
    expect(selectedDay).toHaveFocus();
  });

  it("skips the panel close delay when reduced motion is requested", async () => {
    vi.useFakeTimers();
    media({ reduced: true });
    mockFetch(observerPayload);
    render(<TripApp inviteToken="invite-123" />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: /1일차/ }));
    await act(async () => vi.advanceTimersByTime(0));

    expect(screen.queryByRole("navigation", { name: "여행 일정" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "일정 패널 열기" })).toHaveFocus();
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

  it("does not let an older observer poll overwrite a newer personal-link session", async () => {
    const token = "s".repeat(43);
    const oldPoll = deferred<Response>();
    let tripRequests = 0;
    vi.stubGlobal("fetch", vi.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/trip/")) {
        tripRequests += 1;
        if (tripRequests === 1) return Promise.resolve(json(observerPayload));
        if (tripRequests === 2) return oldPoll.promise;
        return Promise.resolve(json(contributorPayload));
      }
      if (url === "/api/session/claim") return Promise.resolve(json({ role: "contributor" }));
      throw new Error(`unexpected request: ${url}`);
    }));
    render(<TripApp inviteToken="invite-123" />);
    await screen.findByText("공개 일정만 보기");

    fireEvent.focus(window);
    window.location.hash = `join=${token}`;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await screen.findByRole("heading", { name: "의견 남기기" });

    await act(async () => oldPoll.resolve(json(observerPayload)));
    expect(screen.getByRole("heading", { name: "의견 남기기" })).toBeInTheDocument();
  });

  it("keeps the last trip visible when a successful claim refresh temporarily fails", async () => {
    const token = "t".repeat(43);
    let tripRequests = 0;
    vi.stubGlobal("fetch", vi.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/session/claim") return Promise.resolve(json({ role: "contributor" }));
      if (url.includes("/api/trip/")) {
        tripRequests += 1;
        return Promise.resolve(tripRequests === 1 ? json(observerPayload) : json({ error: "unavailable" }, 503));
      }
      throw new Error(`unexpected request: ${url}`);
    }));
    render(<TripApp inviteToken="invite-123" />);
    await screen.findByText("공개 일정만 보기");

    window.location.hash = `join=${token}`;
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(await screen.findByText("최신 데이터를 불러오지 못했습니다. 기존 일정을 표시합니다.")).toHaveAttribute("role", "alert");
    expect(screen.getByRole("navigation", { name: "여행 일정" })).toBeInTheDocument();
  });

  it("aborts the active trip request on unmount", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    }));
    const { unmount } = render(<TripApp inviteToken="invite-123" />);
    await act(async () => {});

    expect(signal).toBeDefined();
    unmount();
    expect(signal?.aborted).toBe(true);
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
