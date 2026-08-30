// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteFinalizer } from "./RouteFinalizer";

const finalized = [{
  segmentKey: "kyoto-odawara" as const,
  status: "finalized" as const,
  label: "철도 이동" as const,
  geometry: [[35.01, 135.76], [35.25, 139.15]] as const,
}];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RouteFinalizer", () => {
  it("shows the fixed Skyliner Narita segment without an admin mode choice", () => {
    render(<RouteFinalizer railRoutes={finalized} onRefresh={vi.fn(async () => {})} />);

    expect(screen.getByText("KIX → 교토")).toBeInTheDocument();
    expect(screen.getByText("교토 → 오다와라")).toBeInTheDocument();
    expect(screen.getByText("오다와라 → 도쿄")).toBeInTheDocument();
    expect(screen.getByText("우에노 → 나리타")).toBeInTheDocument();
    expect(screen.getByText("확정 완료")).toBeInTheDocument();
    expect(screen.getAllByText("경로 확정 전")).toHaveLength(3);
    expect(screen.getAllByLabelText(/출발 시각/)).toHaveLength(4);
    expect(screen.queryByRole("combobox", { name: "나리타 철도 선택" })).not.toBeInTheDocument();
  });

  it("sends an RFC3339 departure with the fixed Skyliner choice, then refreshes", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ route: { segmentKey: "tokyo-narita", status: "finalized" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const onRefresh = vi.fn(async () => {});
    render(<RouteFinalizer railRoutes={[]} onRefresh={onRefresh} />);

    fireEvent.change(screen.getByLabelText("우에노 → 나리타 출발 시각"), { target: { value: "2026-10-06T09:30" } });
    fireEvent.click(screen.getByRole("button", { name: "우에노 → 나리타 경로 확정" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/admin/routes/tokyo-narita/finalize",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ departureTime: "2026-10-06T00:30:00.000Z", naritaRailChoice: "skyliner" }),
      },
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("철도 경로를 확정했습니다.");
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows loading and a recoverable error while preserving placeholder status", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    const onRefresh = vi.fn(async () => {});
    render(<RouteFinalizer railRoutes={[]} onRefresh={onRefresh} />);

    fireEvent.change(screen.getByLabelText("KIX → 교토 출발 시각"), { target: { value: "2026-10-02T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "KIX → 교토 경로 확정" }));

    expect(screen.getByRole("button", { name: "확정 중…" })).toBeDisabled();
    resolve(new Response(JSON.stringify({ error: "route_unavailable" }), { status: 502 }));
    expect(await screen.findByRole("status")).toHaveTextContent("기존 경로를 유지합니다.");
    expect(screen.getAllByText("경로 확정 전")).toHaveLength(4);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
