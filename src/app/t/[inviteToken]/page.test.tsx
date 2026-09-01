import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

vi.mock("next/navigation", () => ({ redirect }));
import TripPage from "./page";

describe("legacy token page", () => {
  it("redirects every old token URL to the tokenless root without retaining a fragment", () => {
    expect(() => TripPage()).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/#");
  });
});
