import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("participant code issuance command", () => {
  it("loads the TypeScript entrypoint and reaches its dedicated environment validation", () => {
    const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const result = spawnSync(executable, ["codes:issue"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        INVITE_TOKEN: "",
        SESSION_PEPPER: "",
        SUPABASE_SECRET_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_URL: "",
      },
    });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("Missing required participant code environment variables");
    expect(output).not.toContain("ERR_MODULE_NOT_FOUND");
  });
});
