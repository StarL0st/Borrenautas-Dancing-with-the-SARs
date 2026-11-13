# 06. Agent Collaboration Spec

Defines who owns what, how work flows between three people and their Claude Code agents, the git workflow, the skills the build agent must create, and how to stay within plan usage limits.

## 1. Roles

- **Three humans, three lane agents.** Each human runs one Claude Code session in their own git worktree and owns the lane's output.
- **Humans merge. Agents never merge their own PRs.** The owner reviews every PR from their agent.
- **Spec keeper:** one human (default: Lane 3) approves spec status changes, acceptance-criteria changes, and contract changes.
- Executors (Qwen3.6-27B) are supervised by the lane agent; see `docs/07-qwen-delegation-spec.md`.

## 2. Lanes (default; rebalance at kickoff once the study area is known)

| Lane | Name | Owns (paths) | Primary specs |
|---|---|---|---|
| **L1** | Backend: data and analysis | `pipeline/`, `data/` | F02, F03 |
| **L2** | Frontend | `web/` (except `web/public/data/`, which is generated) | F04, F05 (UI) |
| **L3** | Story and integration | `docs/` (except `docs/04-contracts.md`), `specs/`, `tasks/`, `README.md`, `scripts/`, `Makefile`, `.github/` | F01 (with L1), F05 (content), F06, F07 |

Shared, change only by agreement: `contracts/`, `docs/04-contracts.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/`. The spec keeper merges changes here.

`scripts/lanes.json` is the machine-readable form of this table. `docs/ownership.md` mirrors it for humans.

If L1 is overloaded after kickoff (heavy analysis), split it into pipeline (data) and analysis, and give L3 the integration role only.

## 3. Spec lifecycle

`Draft` -> `Approved` -> `In progress` -> `In review` -> `Done`.

- Only the spec keeper moves a spec to `Approved`. Agents implement only `Approved` specs.
- Agents never edit acceptance criteria to match their implementation. If a criterion is wrong, the PR carries a "Spec issue" note and the spec keeper decides.
- A spec must be implementable without questions. If an agent has to ask, the spec is incomplete: stop and write a handoff note.

## 4. Timeline (T0 = official start; confirm local times)

| When | Focus |
|---|---|
| T+0 to T+3h | Flip gate to GO. F01: shortlist, coverage checks, decide study area (ADR-002). Ratify product spec. |
| T+3 to T+5h | Approve F02 and F04. Freeze contracts at v0.1.0 (about T+5h). First tasks on the board. |
| T+5h to Deadline-12h | Build in lanes. Integration check every 3 to 4 hours. |
| Deadline-12h | Feature freeze for new scope. Fixes and polish only after this. |
| Deadline-8h | Content freeze (story text, methods). Demo script locked. |
| Deadline-6h to -3h | Video recording, slides, README, submission page draft. |
| Deadline-2h | Submit. Tag `submission-v1`. |
| Last 2h | Buffer only. |

## 5. Git workflow

- **Trunk-based.** `main` is always buildable and always contains a working demo path.
- **Branches:** `<lane>/F##-short-desc` (e.g. `backend/F02-fetch`, `frontend/F04-map`, `story/F05-content`). Short-lived: hours, not days.
- **Worktrees:** one per lane agent, created with `make worktree LANE=<lane> NAME=<branch>`. Each starts its Claude Code session inside its own worktree. This also keeps executor runs isolated.
- **Commits:** prefix with the spec ID: `F02: add granule downloader` (`chore:`, `docs:`, `kickoff:` for work outside a spec). Enforced by the `.githooks/commit-msg` hook.
- **Commit cadence (constant commits):**
  - Commit every time a check passes, and at least every 30 minutes of active work. Work in progress is fine: `F02: wip <what>`. Squash on merge if the history is noisy.
  - Push your branch at least every hour, and always before a break, a standup, or a handoff. Unpushed work is lost work if a laptop or session dies.
  - Never end a session (or hit a usage limit) with uncommitted changes. Commit as `wip`, push, then write the handoff.
  - Agents commit after each acceptance criterion they satisfy, not once at the end of a spec.
  - Enforced by hooks, not memory: the session-start hook warns when the last commit is older than 30 minutes, and the stop hook warns about uncommitted or unpushed changes (see section 8).
- **Git setup (every person, once per clone):** `make setup` also runs `git config core.hooksPath .githooks`, `git config pull.rebase true`, `git config rebase.autoStash true`, and `git config push.autoSetupRemote true`. `.gitattributes` forces LF for scripts so Windows clones do not break `bash`.
- **PRs:** one spec or task per PR, using the PR template. One human review is enough; target merge within 30 minutes. CI must pass.
- **Rebase on `main`** before opening a PR and whenever `main` moves under you.
- **Hotspot files** (the web entry point, the Makefile, `AGENTS.md`) stay thin. Add features as new modules so lanes do not collide.
- **Branch protection** on `main`: PR required, CI required, no force-push.
- **Tag** the submission build `submission-v1`.

## 6. Skills the build agent must create (`.claude/skills/<name>/SKILL.md`)

Each needs front matter (`name`, `description` written so it triggers correctly) and the sections: **When to use**, **Inputs**, **Steps**, **Output**, **Guardrails**. Keep each under about 60 lines.

| Skill | When to use | Steps (summary) | Output |
|---|---|---|---|
| `implement-spec` | Given an approved spec ID (e.g. F04) | Check gate and spec status; read the read-order docs and the spec; restate acceptance criteria and flag untestable ones; implement only in your lane; run `make lint test validate`; fill the PR template with evidence per criterion; update spec status | A branch and PR with evidence mapped to criteria |
| `write-spec` | Spec keeper needs a new or revised spec | Use `specs/_template.md`; convert a rough idea into goal, rules, testable acceptance criteria, edge cases, test plan; reference contracts, not code | A spec file with status `Draft` |
| `review-against-spec` | Reviewing a PR or an executor result | Take spec, criteria, diff, and test output only; check each criterion pass/fail with evidence; list out-of-lane edits, new dependencies, contract changes, secrets or data files | A short pass/fail report per criterion plus blocking issues |
| `handoff` | Stopping, blocked, or near a usage limit | Summarize done, in progress, next steps, blockers, exact commands to resume | `tasks/handoffs/<timestamp>-<lane>.md` |
| `integration-check` | Every 3 to 4 hours, and before freezes | Update from `main`; run `make setup lint test validate build smoke`; open the built app; list breakages and which lane owns each | A short report, board updates |
| `data-source-notes` | A dataset or API is evaluated or used | Record URL, product, maturity, coverage, dates, polarizations, units/scaling, license, quirks, sample access snippet | New or updated row and notes in `docs/03-data-sources.md` |
| `delegate-to-executor` | A task is well specified and sized for the executor, **and an executor is configured on this machine** (otherwise skip and implement directly) | Write a task brief from the template; run `make delegate`; read `RESULT.md` and the diff stat first; review with `review-against-spec`; retry up to twice with specific feedback; then escalate | A reviewed branch, run logged in `tasks/results/runs.csv` |
| `demo-prep` | Preparing demo and submission | Keep script, README, video checklist, and credits in sync with what works on `main` | Updated `docs/08` checklist and demo script |

## 7. Reviewer subagent (`.claude/agents/spec-reviewer.md`)

Read-only: tools limited to reading files and running read-only git commands (`git diff`, `git log`). Input: spec path and diff range. Output: the same pass/fail format as `review-against-spec`. Used by lane agents to review executor output without polluting the main session context.

## 8. Hooks

- Post-edit: run `scripts/post-edit.sh` on the edited file (fast lint only).
- Session start: print gate status, current branch, lane, and a warning if the last commit is older than 30 minutes or the branch has unpushed commits.
- Stop (end of agent turn): if the worktree has uncommitted changes or unpushed commits, print a reminder to commit (`wip` is fine) and push. Warn only; never block.
- Git `commit-msg` (`.githooks/commit-msg`): reject messages that do not start with `F##:`, `T-###:`, `chore:`, `docs:`, `fix:`, or `kickoff:`.
- No hook may take more than about 10 seconds, and style failures only warn.

## 9. Usage budget protocol

Plans have rolling 5-hour and weekly limits shared across chat and Claude Code, and exact numbers are not published. Treat agent capacity as scarce.

1. Check `/status` at every integration check; record each person's headroom in `tasks/BOARD.md`.
2. Spend the strongest included model on specs, contracts, ADRs, and reviews. Use a mid-tier model for implementation. Do not use credit-billed models without team agreement. Make sure no stray `ANTHROPIC_API_KEY` is set (it switches billing off the plan).
3. Keep `AGENTS.md`, `CLAUDE.md`, and specs short; they load every session.
4. One task per fresh session. Point agents at specific files; never "read the repo".
5. Put bulk implementation on the executor (`docs/07`) to save Claude capacity.
6. Reserve capacity for the last 10 hours: integration bugs and demo fixes cost the most then.
7. Write a handoff before hitting a limit, so a teammate's agent can continue from the spec.

## 10. Handoff note format

```
# Handoff: <lane>, <timestamp>
Spec/task: F##, T-###
Done: ...
In progress (files, state): ...
Next steps (ordered): ...
Blockers / questions: ...
Resume with: <exact commands>
```

## 11. Communication cadence

- 10-minute standup every 3 to 4 hours, right after an integration check.
- `tasks/BOARD.md` is updated by the owner of each task when status changes.
- Questions that block a lane go to the spec keeper immediately, not into the next standup.
