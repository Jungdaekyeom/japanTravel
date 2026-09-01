# Git and Codex operating contract

This repository uses Codex with `workspace-write` sandboxing, an `on-request`
approval policy, user review of approvals, and no workspace-write network
access.

## Host and credential boundary

- Only the Mac mini may edit, test, commit, or push for this repository.
- The company MacBook and Android are command, review, and approval clients;
  execution occurs on the Mac mini.
- GitHub credentials remain on the Mac mini.
- Do not handle company source code or company Git credentials in this
  project.

## Branch and worktree scope

- Base branch: `origin/codex/japan-trip-app`.
- Use a dedicated implementation branch and worktree named `codex/<slug>`.
- Do not directly merge into or delete the base branch.
- Preserve the remote base branch and all existing Git history.
- Load the actual worktree as a trusted project before editing, testing,
  committing, or pushing.

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
- Git global-option prefixes such as `-c`, `--config-env`, `--git-dir`, and
  `--work-tree` require explicit user approval. The rules DSL matches only
  literal argv prefixes: attached-value forms such as `--git-dir=.git` and
  alternate executable paths or wrappers are not matched, so request explicit
  approval before using them.
- Do not force-push, including `--force`, `-f`, or `--force-with-lease`.

## Out of scope

Voice and audio work is entirely out of scope for this operating contract.
