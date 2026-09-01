import {
  ApiError,
  approveOpinion,
  claimSession,
  dashboard,
  deleteSession,
  finalizeRailRoute,
  rejectOpinion,
} from "./api";
import type { OwnerSession } from "./types";

const origin = "https://owner.example";
const session: OwnerSession = {
  accessToken: "a".repeat(43),
  expiresAt: "2026-10-01T00:00:00.000Z",
};
const originalFetch = globalThis.fetch;
const originalOrigin = process.env.EXPO_PUBLIC_API_ORIGIN;
const fetchMock = jest.fn();

function response(status = 200, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_ORIGIN = origin;
  globalThis.fetch = fetchMock as typeof fetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(response());
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalOrigin === undefined) delete process.env.EXPO_PUBLIC_API_ORIGIN;
  else process.env.EXPO_PUBLIC_API_ORIGIN = originalOrigin;
});

test("claims a session with a 43-character code and no bearer header", async () => {
  const code = "c".repeat(43);
  fetchMock.mockResolvedValueOnce(response(200, session));

  await expect(claimSession(code)).resolves.toEqual(session);
  expect(fetchMock).toHaveBeenCalledWith(`${origin}/api/owner/session/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: code }),
  });
});

test("rejects a malformed claim code before making a request", () => {
  expect(() => claimSession("c".repeat(42))).toThrow("관리 코드는 43자리여야 합니다.");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("loads the dashboard with the owner bearer session", async () => {
  await dashboard(session);

  expect(fetchMock).toHaveBeenCalledWith(`${origin}/api/owner/dashboard`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
});

test("approves an opinion with a bearer POST", async () => {
  await approveOpinion(session, "opinion-1");

  expect(fetchMock).toHaveBeenCalledWith(`${origin}/api/admin/opinions/opinion-1/approve`, {
    method: "POST",
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
});

test("rejects an opinion with its full JSON reason", async () => {
  const input = {
    category: "schedule_impossible" as const,
    publicSummary: "일정상 반영하기 어렵습니다.",
    reason: "확정된 이동 시간과 겹칩니다.",
  };

  await rejectOpinion(session, "opinion-2", input);

  expect(fetchMock).toHaveBeenCalledWith(`${origin}/api/admin/opinions/opinion-2/reject`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
});

test("finalizes a regular rail route without a Narita choice", async () => {
  await finalizeRailRoute(session, "kix-kyoto", "2026-10-02T09:00:00+09:00");

  expect(fetchMock).toHaveBeenCalledWith(`${origin}/api/admin/routes/kix-kyoto/finalize`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ departureTime: "2026-10-02T09:00:00+09:00" }),
  });
});

test("includes the fixed Skyliner choice only when finalizing the Narita route", async () => {
  await finalizeRailRoute(session, "tokyo-narita", "2026-10-06T08:30:00+09:00", "skyliner");

  expect(fetchMock).toHaveBeenCalledWith(`${origin}/api/admin/routes/tokyo-narita/finalize`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      departureTime: "2026-10-06T08:30:00+09:00",
      naritaRailChoice: "skyliner",
    }),
  });
});

test("deletes the bearer session and accepts an empty 204 response", async () => {
  fetchMock.mockResolvedValueOnce(response(204));

  await expect(deleteSession(session)).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenCalledWith(`${origin}/api/owner/session`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
});

test("exposes the HTTP status for non-successful responses", async () => {
  fetchMock.mockResolvedValueOnce(response(403));

  const request = dashboard(session);
  await expect(request).rejects.toBeInstanceOf(ApiError);
  await expect(request).rejects.toMatchObject({ status: 403 });
});
