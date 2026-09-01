// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_TRIP_DEFINITION, type DayNumber, type SharedTripPayload } from "../../../trip/public";
import { TRAVELERS, type TravelerId } from "../../../trip/travelers";

type MockProps = {
  selectedTravelerId: TravelerId | null;
  selectedDay: DayNumber | null;
  onPlaybackComplete: (day: DayNumber) => void;
};

vi.mock("../../../components/map/GoogleTripMap", () => ({
  GoogleTripMap: ({ selectedTravelerId, selectedDay, onPlaybackComplete }: MockProps) => (
    <>
      <output aria-label="지도 선택">{selectedTravelerId ?? "all"}:{selectedDay ?? "overview"}</output>
      <button type="button" disabled={!selectedDay} onClick={() => selectedDay && onPlaybackComplete(selectedDay)}>지도 재생 완료</button>
    </>
  ),
}));

import { TripApp } from "./TripApp";

const sharedPayload: SharedTripPayload = {
  trip: PUBLIC_TRIP_DEFINITION,
  travelers: TRAVELERS,
  railRoutes: [],
};

function media() {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

beforeEach(() => {
  vi.useFakeTimers();
  media();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(sharedPayload), {
    status: 200,
    headers: { "content-type": "application/json" },
  })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TripApp 전체 일정 재생", () => {
  it("keeps every traveler's routes visible while all days advance from 1 through 5", async () => {
    render(<TripApp />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "일정 패널 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "전체 일정" }));
    await act(async () => vi.advanceTimersByTime(0));

    const complete = screen.getByRole("button", { name: "지도 재생 완료" });
    expect(screen.getByLabelText("지도 선택")).toHaveTextContent("all:1");
    for (const day of [2, 3, 4, 5]) {
      fireEvent.click(complete);
      expect(screen.getByLabelText("지도 선택")).toHaveTextContent(`all:${day}`);
    }
    fireEvent.click(complete);

    expect(screen.getByText("전원 전체 일정 경로 재생 완료")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "전체 일정 다시 재생" }));
    expect(screen.getByLabelText("지도 선택")).toHaveTextContent("all:1");
    expect(screen.getByText("전원 전체 일정 · 1일차 경로 다시 재생 중")).toBeInTheDocument();
    for (const day of [2, 3, 4, 5]) {
      fireEvent.click(complete);
      expect(screen.getByLabelText("지도 선택")).toHaveTextContent(`all:${day}`);
    }
    fireEvent.click(complete);
    expect(screen.getByText("전원 전체 일정 경로 재생 완료")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체 일정 다시 재생" })).toBeInTheDocument();
  });
});
