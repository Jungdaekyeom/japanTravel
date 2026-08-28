import { describe, expect, it } from "vitest";

import { parseIssueCodeMode } from "./issue-participant-codes-options";

describe("parseIssueCodeMode", () => {
  it("refuses existing codes by default and permits only an explicit rotation flag", () => {
    expect(parseIssueCodeMode([])).toBe("issue");
    expect(parseIssueCodeMode(["--rotate"])).toBe("rotate");
    expect(() => parseIssueCodeMode(["--force"])).toThrow("Usage: pnpm codes:issue [--rotate]");
  });
});
