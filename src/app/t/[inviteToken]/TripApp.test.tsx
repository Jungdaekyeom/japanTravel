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
  it("loads only the public trip endpoint and renders no auth or opinion entry points", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("/api/trip");
      return json(sharedPayload);
    });
    vi.stubGlobal("fetch", fetch);

    render(<TripApp />);

    expect(await screen.findByRole("navigation", { name: "여행 일정" })).toBeInTheDocument();
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
    await screen.findByRole("navigation", { name: "여행 일정" });
    fireEvent.focus(window);

    expect(await screen.findByText("최신 데이터를 불러오지 못했습니다. 기존 일정을 표시합니다.")).toHaveAttribute("role", "alert");
    expect(screen.getByRole("navigation", { name: "여행 일정" })).toBeInTheDocument();
  });
});
