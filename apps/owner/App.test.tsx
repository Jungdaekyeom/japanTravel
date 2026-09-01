import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { RefreshControl } from "react-native";

import App from "./App";
import { ApiError, approveOpinion, claimSession, dashboard, deleteSession, finalizeRailRoute, rejectOpinion } from "./src/api";
import { isSupportedOwnerDevice } from "./src/device";
import { clearSession, loadSession, saveSession } from "./src/session";
import type { OwnerDashboard, OwnerSession } from "./src/types";

jest.mock("./src/device", () => ({ isSupportedOwnerDevice: jest.fn(() => false) }));
jest.mock("./src/session", () => ({ loadSession: jest.fn(), clearSession: jest.fn(), saveSession: jest.fn() }));
jest.mock("./src/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(status: number) {
      super();
      this.status = status;
    }
  },
  claimSession: jest.fn(),
  dashboard: jest.fn(),
  approveOpinion: jest.fn(),
  rejectOpinion: jest.fn(),
  finalizeRailRoute: jest.fn(),
  deleteSession: jest.fn(),
}));

describe("App", () => {
  const session: OwnerSession = { accessToken: "a".repeat(43), expiresAt: "2026-10-01T00:00:00.000Z" };
  const pendingOpinion = { id: "f1d3e7a4-706f-4db1-a7d1-0bb98ed129c8", authorName: "민수", targetDay: 2, body: "교토 야경을 추가하고 싶어요.", createdAt: "2026-09-01T00:00:00.000Z" };
  const fourSegments: OwnerDashboard["railSegments"] = [
    { key: "kix-kyoto", title: "KIX → 교토", tripDate: "2026-10-02", finalized: false, departureTime: null, expiresAt: null, naritaRailChoice: null, canFinalize: true },
    { key: "kyoto-odawara", title: "교토 → 오다와라", tripDate: "2026-10-03", finalized: false, departureTime: null, expiresAt: null, naritaRailChoice: null, canFinalize: true },
    { key: "odawara-tokyo", title: "오다와라 → 도쿄", tripDate: "2026-10-04", finalized: false, departureTime: null, expiresAt: null, naritaRailChoice: null, canFinalize: true },
    { key: "tokyo-narita", title: "우에노 → 나리타", tripDate: "2026-10-06", finalized: false, departureTime: null, expiresAt: null, naritaRailChoice: "skyliner", canFinalize: true },
  ];
  const dashboardData: OwnerDashboard = {
    pendingOpinions: [pendingOpinion],
    railSegments: fourSegments,
    finalizationOpensAt: "2026-09-07T00:00:00.000Z",
    finalizationClosesAt: "2026-10-07T00:00:00.000Z",
  };
  const emptyDashboard: OwnerDashboard = { ...dashboardData, pendingOpinions: [] };

  function startWithDashboard(data = dashboardData) {
    (isSupportedOwnerDevice as jest.Mock).mockReturnValue(true);
    (loadSession as jest.Mock).mockResolvedValue(session);
    (dashboard as jest.Mock).mockResolvedValue(data);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    (isSupportedOwnerDevice as jest.Mock).mockReturnValue(false);
  });

  it("shows the Korean unsupported-device message before session or network work", () => {
    render(<App />);

    expect(screen.getByText("이 기기는 일본여행 관리 앱을 사용할 수 없습니다.")).toBeOnTheScreen();
    expect(isSupportedOwnerDevice).toHaveBeenCalledTimes(1);
    expect(loadSession).not.toHaveBeenCalled();
    expect(dashboard).not.toHaveBeenCalled();
  });

  it("ends startup loading and offers enrollment when stored session loading fails", async () => {
    (isSupportedOwnerDevice as jest.Mock).mockReturnValue(true);
    (loadSession as jest.Mock).mockRejectedValue(new Error("SecureStore unavailable"));

    render(<App />);

    expect(await screen.findByLabelText("관리 코드")).toBeOnTheScreen();
    expect(screen.getByRole("alert")).toHaveTextContent("저장된 관리 정보를 불러오지 못했습니다. 관리 코드를 다시 등록해 주세요.");
    expect(dashboard).not.toHaveBeenCalled();
  });

  it("revokes a claimed session and stays on enrollment when secure storage fails", async () => {
    (isSupportedOwnerDevice as jest.Mock).mockReturnValue(true);
    (loadSession as jest.Mock).mockResolvedValue(null);
    (claimSession as jest.Mock).mockResolvedValue(session);
    (saveSession as jest.Mock).mockRejectedValue(new Error("SecureStore unavailable"));
    (deleteSession as jest.Mock).mockRejectedValue(new Error("network unavailable"));

    render(<App />);

    fireEvent.changeText(await screen.findByLabelText("관리 코드"), "a".repeat(43));
    fireEvent.press(screen.getByRole("button", { name: "관리 코드 등록" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("관리 정보를 기기에 저장하지 못했습니다. 새 관리 코드를 발급받아 다시 시도해 주세요.");
    expect(screen.getByLabelText("관리 코드")).toBeOnTheScreen();
    expect(deleteSession).toHaveBeenCalledWith(session);
    expect(dashboard).not.toHaveBeenCalled();
  });

  it("saves a successful enrollment before loading its dashboard", async () => {
    const code = "c".repeat(43);
    (isSupportedOwnerDevice as jest.Mock).mockReturnValue(true);
    (loadSession as jest.Mock).mockResolvedValue(null);
    (claimSession as jest.Mock).mockResolvedValue(session);
    (saveSession as jest.Mock).mockResolvedValue(undefined);
    (dashboard as jest.Mock).mockResolvedValue(dashboardData);

    render(<App />);

    fireEvent.changeText(await screen.findByLabelText("관리 코드"), code);
    fireEvent.press(screen.getByRole("button", { name: "관리 코드 등록" }));

    expect(await screen.findByText(pendingOpinion.body)).toBeOnTheScreen();
    expect(claimSession).toHaveBeenCalledWith(code);
    expect(saveSession).toHaveBeenCalledWith(session);
    expect(dashboard).toHaveBeenCalledWith(session);
    expect((claimSession as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((saveSession as jest.Mock).mock.invocationCallOrder[0]);
    expect((saveSession as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((dashboard as jest.Mock).mock.invocationCallOrder[0]);
  });

  it("clears an unauthorized stored session and returns to enrollment", async () => {
    (isSupportedOwnerDevice as jest.Mock).mockReturnValue(true);
    (loadSession as jest.Mock).mockResolvedValue(session);
    (dashboard as jest.Mock).mockRejectedValue(new ApiError(401));

    render(<App />);

    expect(await screen.findByLabelText("관리 코드")).toBeOnTheScreen();
    expect(clearSession).toHaveBeenCalled();
  });

  it("approves an opinion and refreshes the queue", async () => {
    startWithDashboard();
    (approveOpinion as jest.Mock).mockResolvedValue(undefined);
    (dashboard as jest.Mock)
      .mockResolvedValueOnce(dashboardData)
      .mockResolvedValueOnce(emptyDashboard);

    render(<App />);

    expect(await screen.findByText(pendingOpinion.body)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "의견 승인" }));

    await waitFor(() => expect(screen.getByText("검토할 의견이 없습니다.")).toBeOnTheScreen());
    expect(approveOpinion).toHaveBeenCalledWith(session, pendingOpinion.id);
    expect(dashboard).toHaveBeenCalledTimes(2);
  });

  it("validates rejection lengths and sends the selected category with trimmed details", async () => {
    startWithDashboard();
    (rejectOpinion as jest.Mock).mockResolvedValue(undefined);
    (dashboard as jest.Mock)
      .mockResolvedValueOnce(dashboardData)
      .mockResolvedValueOnce(emptyDashboard);

    render(<App />);

    expect(await screen.findByText(pendingOpinion.body)).toBeOnTheScreen();
    const rejectButton = screen.getByRole("button", { name: "의견 반려" });
    expect(rejectButton).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText("공개 요약"), "요".repeat(81));
    fireEvent.changeText(screen.getByLabelText("반려 사유"), "유효한 사유");
    expect(rejectButton).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText("공개 요약"), "유효한 요약");
    fireEvent.changeText(screen.getByLabelText("반려 사유"), "사".repeat(301));
    expect(rejectButton).toBeDisabled();

    fireEvent.press(screen.getByRole("button", { name: "안전·위법" }));
    fireEvent.changeText(screen.getByLabelText("공개 요약"), "  안전 문제로 반영하기 어렵습니다.  ");
    fireEvent.changeText(screen.getByLabelText("반려 사유"), "  야간 이동 구간의 안전을 확인할 수 없습니다.  ");
    fireEvent.press(rejectButton);

    await waitFor(() => expect(screen.getByText("검토할 의견이 없습니다.")).toBeOnTheScreen());
    expect(rejectOpinion).toHaveBeenCalledWith(session, pendingOpinion.id, {
      category: "unsafe_or_illegal",
      publicSummary: "안전 문제로 반영하기 어렵습니다.",
      reason: "야간 이동 구간의 안전을 확인할 수 없습니다.",
    });
    expect(dashboard).toHaveBeenCalledTimes(2);
  });

  it("combines each rail time with its fixed date and uses Skyliner only for Narita", async () => {
    startWithDashboard(emptyDashboard);
    (finalizeRailRoute as jest.Mock).mockResolvedValue(undefined);

    render(<App />);

    expect(await screen.findByText("검토할 의견이 없습니다.")).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText("KIX → 교토 출발 시각"), "07:05");
    fireEvent.press(screen.getByRole("button", { name: "KIX → 교토 경로 확정" }));

    await waitFor(() => expect(finalizeRailRoute).toHaveBeenCalledWith(session, "kix-kyoto", "2026-10-02T07:05:00+09:00", undefined));

    fireEvent.changeText(screen.getByLabelText("우에노 → 나리타 출발 시각"), "18:40");
    fireEvent.press(screen.getByRole("button", { name: "우에노 → 나리타 경로 확정" }));

    await waitFor(() => expect(finalizeRailRoute).toHaveBeenCalledWith(session, "tokyo-narita", "2026-10-06T18:40:00+09:00", "skyliner"));
    expect(finalizeRailRoute).toHaveBeenCalledTimes(2);
    expect(dashboard).toHaveBeenCalledTimes(3);
  });

  it("keeps the current dashboard and shows retry guidance when pull-to-refresh loses the network", async () => {
    startWithDashboard();
    (dashboard as jest.Mock)
      .mockResolvedValueOnce(dashboardData)
      .mockRejectedValueOnce(new Error("network unavailable"));

    render(<App />);

    expect(await screen.findByText(pendingOpinion.body)).toBeOnTheScreen();
    fireEvent(screen.UNSAFE_getByType(RefreshControl), "refresh");

    expect(await screen.findByRole("alert")).toHaveTextContent("연결을 확인한 뒤 다시 시도해 주세요.");
    expect(screen.getByText(pendingOpinion.body)).toBeOnTheScreen();
    expect(dashboard).toHaveBeenCalledTimes(2);
  });

  it("clears local state and returns to enrollment when logout is unauthorized", async () => {
    startWithDashboard(emptyDashboard);
    (deleteSession as jest.Mock).mockRejectedValue(new ApiError(403));

    render(<App />);

    expect(await screen.findByText("검토할 의견이 없습니다.")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "로그아웃" }));

    expect(await screen.findByLabelText("관리 코드")).toBeOnTheScreen();
    expect(clearSession).toHaveBeenCalled();
  });

  it("returns to enrollment even when clearing an unauthorized session fails", async () => {
    (isSupportedOwnerDevice as jest.Mock).mockReturnValue(true);
    (loadSession as jest.Mock).mockResolvedValue(session);
    (dashboard as jest.Mock).mockRejectedValue(new ApiError(401));
    (clearSession as jest.Mock).mockRejectedValue(new Error("SecureStore unavailable"));

    render(<App />);

    expect(await screen.findByLabelText("관리 코드")).toBeOnTheScreen();
    expect(screen.getByRole("alert")).toHaveTextContent("다시 관리 코드를 등록해 주세요.");
  });

  it("returns to enrollment when local cleanup fails after server logout succeeds", async () => {
    startWithDashboard(emptyDashboard);
    (deleteSession as jest.Mock).mockResolvedValue(undefined);
    (clearSession as jest.Mock).mockRejectedValue(new Error("SecureStore unavailable"));

    render(<App />);

    expect(await screen.findByText("검토할 의견이 없습니다.")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "로그아웃" }));

    expect(await screen.findByLabelText("관리 코드")).toBeOnTheScreen();
    expect(screen.getByRole("alert")).toHaveTextContent("서버 로그아웃은 완료됐지만 기기의 관리 정보를 삭제하지 못했습니다. 관리 코드를 다시 등록해 주세요.");
  });
});
