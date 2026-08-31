# Git and Codex operating contract

This repository uses Codex with `workspace-write` sandboxing, an `on-request`
approval policy, user review of approvals, and no workspace-write network
access.

## Host and credential boundary

- Only the Mac mini may edit, test, commit, or push for this repository.
- The company MacBook and Android are review and approval clients only.
- GitHub credentials remain on the Mac mini.

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
- Git commands using a path override, such as `git -C <path> ...`, require
  explicit user approval.
- Do not force-push, including `--force`, `-f`, or `--force-with-lease`.

## Out of scope

Voice and audio work is entirely out of scope for this operating contract.
