import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

describe("personal-link issuance command", () => {
  it("loads the TypeScript entrypoint and reaches its dedicated environment validation", () => {
    const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const result = spawnSync(executable, ["links:issue"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        INVITE_TOKEN: "",
        APP_ORIGIN: "",
        SESSION_PEPPER: "",
        SUPABASE_SECRET_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_URL: "",
      },
    });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("Missing required personal-link environment variables");
    expect(output).not.toContain("ERR_MODULE_NOT_FOUND");
  });

  it("loads participant credentials from .env.local before validation", () => {
    const workingDirectory = mkdtempSync(join(tmpdir(), "japan-travel-links-"));
    const childEnvironment = { ...process.env };
    delete childEnvironment.SUPABASE_URL;
    delete childEnvironment.SUPABASE_SECRET_KEY;
    delete childEnvironment.SUPABASE_SERVICE_ROLE_KEY;
    delete childEnvironment.SESSION_PEPPER;
    delete childEnvironment.APP_ORIGIN;
    delete childEnvironment.INVITE_TOKEN;

    writeFileSync(
      join(workingDirectory, ".env.local"),
      [
        "SUPABASE_URL=ftp://example.com",
        "SUPABASE_SECRET_KEY=test-secret",
        "APP_ORIGIN=https://trip.example.com",
        "INVITE_TOKEN=invite-token",
      ].join("\n"),
    );

    try {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          createRequire(import.meta.url).resolve("tsx"),
          resolve(process.cwd(), "scripts/issue-personal-links.ts"),
        ],
        {
          cwd: workingDirectory,
          encoding: "utf8",
          env: childEnvironment,
        },
      );
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

      expect(result.status).not.toBe(0);
      expect(output).toContain("Invalid supabaseUrl");
      expect(output).not.toContain("Missing required personal-link environment variables");
    } finally {
      rmSync(workingDirectory, { recursive: true, force: true });
    }
  });
});
