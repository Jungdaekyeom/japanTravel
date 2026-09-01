// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_TRIP_DEFINITION, type DayNumber, type SharedTripPayload } from "../../../trip/public";
import { TRAVELERS, type TravelerId } from "../../../trip/travelers";

type MockProps = {
  selectedTravelerId: TravelerId | null;
  selectedDay: DayNumber | null;
  playbackRequest: number;
  onPlaybackComplete: (day: DayNumber) => void;
};

vi.mock("../../../components/map/GoogleTripMap", async () => {
  const { useEffect, useRef } = await import("react");

  return {
    GoogleTripMap: ({ selectedTravelerId, selectedDay, playbackRequest, onPlaybackComplete }: MockProps) => {
      const completedRequest = useRef<string | null>(null);
      const requestKey = selectedDay && playbackRequest > 0 ? `${selectedTravelerId ?? "all"}:${selectedDay}:${playbackRequest}` : null;

      useEffect(() => {
        if (!requestKey || completedRequest.current === requestKey || !selectedDay) return;
        completedRequest.current = requestKey;
        onPlaybackComplete(selectedDay);
      }, [onPlaybackComplete, requestKey, selectedDay]);

      return <output aria-label="지도 선택">{selectedTravelerId ?? "all"}:{selectedDay ?? "overview"}:{playbackRequest}</output>;
    },
  };
});

import { TripApp } from "./TripApp";

const sharedPayload: SharedTripPayload = {
  trip: PUBLIC_TRIP_DEFINITION,
  travelers: TRAVELERS,
  railRoutes: [],
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

function json(payload: object, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
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
  it("starts with the itinerary panel closed while the overview map remains active without moving focus", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(sharedPayload)));

    render(<TripApp />);

    const opener = await screen.findByRole("button", { name: "일정 패널 열기" });
    expect(screen.queryByRole("navigation", { name: "여행 일정" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("지도 선택")).toHaveTextContent("all:overview:0");
    expect(screen.getByText("전체 5일 경로 표시 중")).toBeInTheDocument();
    expect(document.activeElement).not.toBe(opener);
  });

  it("opens the itinerary panel on request without refreshing or starting playback, then focuses its close control", async () => {
    const fetch = vi.fn(async () => json(sharedPayload));
    vi.stubGlobal("fetch", fetch);

    render(<TripApp />);

    fireEvent.click(await screen.findByRole("button", { name: "일정 패널 열기" }));

    const close = await screen.findByRole("button", { name: "일정 패널 닫기" });
    expect(close).toHaveFocus();
    expect(screen.getByLabelText("지도 선택")).toHaveTextContent("all:overview:0");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the opener after a user closes the panel", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(sharedPayload)));

    render(<TripApp />);
    const opener = await screen.findByRole("button", { name: "일정 패널 열기" });
    fireEvent.click(opener);
    const close = await screen.findByRole("button", { name: "일정 패널 닫기" });
    vi.useFakeTimers();
    fireEvent.click(close);
    await act(async () => vi.advanceTimersByTime(0));

    expect(screen.getByRole("button", { name: "일정 패널 열기" })).toHaveFocus();
    expect(screen.queryByRole("navigation", { name: "여행 일정" })).not.toBeInTheDocument();
  });

  it("focuses the close control when reopening after a day selection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(sharedPayload)));

    render(<TripApp />);
    fireEvent.click(await screen.findByRole("button", { name: "일정 패널 열기" }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /1일차/ }));
    await act(async () => vi.advanceTimersByTime(0));

    fireEvent.click(screen.getByRole("button", { name: "일정 패널 열기" }));

    expect(screen.getByRole("button", { name: "일정 패널 닫기" })).toHaveFocus();
    expect(screen.getByRole("button", { name: /^1일차 간사이국제공항/ })).toHaveAttribute("aria-current", "true");
  });

  it("focuses the close control when reopening after an all-days selection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(sharedPayload)));

    render(<TripApp />);
    fireEvent.click(await screen.findByRole("button", { name: "일정 패널 열기" }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "전체 일정" }));
    await act(async () => vi.advanceTimersByTime(0));

    fireEvent.click(screen.getByRole("button", { name: "일정 패널 열기" }));

    expect(screen.getByRole("button", { name: "일정 패널 닫기" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "전체 일정" })).toHaveAttribute("aria-current", "true");
  });

  it("loads only the public trip endpoint and renders no auth or opinion entry points", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("/api/trip");
      return json(sharedPayload);
    });
    vi.stubGlobal("fetch", fetch);

    render(<TripApp />);

    fireEvent.click(await screen.findByRole("button", { name: "일정 패널 열기" }));
    expect(screen.getByRole("navigation", { name: "여행 일정" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "여행자 선택" })).not.toBeInTheDocument();
    for (const name of ["정대겸", "이규열", "박준수", "한규준"]) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/관찰자|참가자|관리자/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /의견|검토/ })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("plays every traveler's routes together after a day is selected", async () => {
    vi.useFakeTimers();
    media({ reduced: false });
    vi.stubGlobal("fetch", vi.fn(async () => json(sharedPayload)));

    render(<TripApp />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "일정 패널 열기" }));
    fireEvent.click(screen.getByRole("button", { name: /1일차/ }));
    await act(async () => vi.advanceTimersByTime(250));
    expect(screen.getByLabelText("지도 선택")).toHaveTextContent("all:1:1");
    expect(screen.getByText("전원 · 1일차 경로 재생 완료")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1일차 경로 다시 재생" })).toBeInTheDocument();
  });

  it("keeps the last payload visible after a refresh failure", async () => {
    let requests = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      requests += 1;
      return requests === 1 ? json(sharedPayload) : json({ error: "unavailable" }, 503);
    }));

    render(<TripApp />);
    fireEvent.click(await screen.findByRole("button", { name: "일정 패널 열기" }));
    expect(screen.getByRole("navigation", { name: "여행 일정" })).toBeInTheDocument();
    fireEvent.focus(window);

    expect(await screen.findByText("최신 데이터를 불러오지 못했습니다. 기존 일정을 표시합니다.")).toHaveAttribute("role", "alert");
    expect(screen.getByRole("navigation", { name: "여행 일정" })).toBeInTheDocument();
  });
});
