// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DayNumber } from "../../../trip/public";
import { PUBLIC_TRIP_DEFINITION } from "../../../trip/public";

vi.mock("../../../components/map/GoogleTripMap", () => ({
  GoogleTripMap: ({ selectedDay, onPlaybackComplete }: { selectedDay: DayNumber | null; onPlaybackComplete: (day: DayNumber) => void }) => (
    <button type="button" disabled={!selectedDay} onClick={() => selectedDay && onPlaybackComplete(selectedDay)}>지도 재생 완료</button>
  ),
}));

import { TripApp } from "./TripApp";

const observerPayload = {
  role: "observer" as const,
  trip: PUBLIC_TRIP_DEFINITION,
  railRoutes: [],
  publicRejections: [],
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
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(observerPayload), {
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
  it("closes the panel and advances days 1 through 5 once per completion", async () => {
    render(<TripApp inviteToken="invite-123" />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "전체 일정" }));
    await act(async () => vi.advanceTimersByTime(0));

    const complete = screen.getByRole("button", { name: "지도 재생 완료" });
    expect(screen.getByRole("status")).toHaveTextContent("전체 일정 · 1일차 경로 재생 중");
    for (const day of [2, 3, 4, 5]) {
      fireEvent.click(complete);
      expect(screen.getByRole("status")).toHaveTextContent(`전체 일정 · ${day}일차 경로 재생 중`);
    }
    fireEvent.click(complete);

    expect(screen.getByRole("status")).toHaveTextContent("전체 일정 경로 재생 완료");
    expect(screen.getByRole("button", { name: "전체 일정 다시 재생" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "전체 일정 다시 재생" }));
    expect(screen.getByRole("status")).toHaveTextContent("전체 일정 · 1일차 경로 다시 재생 중");
  });

  it("cancels continuous playback when a single day is selected", async () => {
    render(<TripApp inviteToken="invite-123" />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "전체 일정" }));
    await act(async () => vi.advanceTimersByTime(0));
    fireEvent.click(screen.getByRole("button", { name: "지도 재생 완료" }));
    expect(screen.getByRole("status")).toHaveTextContent("전체 일정 · 2일차 경로 재생 중");

    fireEvent.click(screen.getByRole("button", { name: "일정 패널 열기" }));
    fireEvent.click(screen.getByRole("button", { name: /4일차/ }));
    await act(async () => vi.advanceTimersByTime(0));
    fireEvent.click(screen.getByRole("button", { name: "지도 재생 완료" }));

    expect(screen.getByRole("status")).toHaveTextContent("4일차 경로 재생 완료");
    expect(screen.getByRole("button", { name: "4일차 경로 다시 재생" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "전체 일정 다시 재생" })).not.toBeInTheDocument();
  });
});
