# Git and Codex operating contract

This repository uses Codex with `workspace-write` sandboxing, an `on-request`
approval policy, user review of approvals, and no workspace-write network
access.

## Branch and worktree scope

- Base branch: `origin/codex/japan-trip-app`.
- Use a dedicated implementation branch and worktree named `codex/<slug>`.
- Do not directly merge into or delete the base branch.

## Local commits

- Stage only files that are within the current task's scope.
- Run the repository's relevant tests before creating a commit.
- `git add` and non-amend `git commit` are permitted after those checks.
- Do not amend commits.

## Remote updates

- Before every push, report the branch name, changed files, test results, and
  commit SHA, then obtain explicit user approval.
- Do not force-push, including `--force`, `-f`, or `--force-with-lease`.

## Out of scope

Voice and audio work is entirely out of scope for this operating contract.
