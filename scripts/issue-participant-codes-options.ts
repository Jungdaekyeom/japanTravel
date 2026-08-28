export function parseIssueCodeMode(args: string[]) {
  if (args.length === 0) return "issue" as const;
  if (args.length === 1 && args[0] === "--rotate") return "rotate" as const;
  throw new Error("Usage: node --experimental-strip-types scripts/issue-participant-codes.ts [--rotate]");
}
