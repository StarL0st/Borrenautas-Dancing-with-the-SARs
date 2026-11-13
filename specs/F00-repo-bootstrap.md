# F00 Repo bootstrap (Phase 0)

Status: Approved
Lane: L3        Owner: spec keeper / build agent
Gate: Allowed under LOCKED
Depends on: all docs in this package
Traces to: process (supports every R-ID)

## Goal
Build the repository scaffolding exactly as described in `docs/05-repo-build-spec.md`, so that, once the gate opens, every lane can start work immediately with agent config, contracts, CI, and delegation tooling already in place.

## Inputs and outputs
- Input: `docs/` and `specs/` from this package.
- Output: the repository tree in `docs/05-repo-build-spec.md` section 3, plus `docs/PHASE0-REPORT.md`.

## Behavior and rules
1. Execute build steps B0 to B14 in order, one commit per step.
2. Do not download science data, choose a study area, or write analysis or feature code.
3. Skeletons contain only stubs, docstrings, and a toolchain check; fixtures are synthetic and labelled.
4. If a check cannot run (for example, no network for installs), record it and continue.
5. Ambiguities are listed in the report; the agent asks before deviating.

## Acceptance criteria
1. Every file in the tree exists, or `PHASE0-REPORT.md` explains the gap.
2. `make gate` exits non-zero while `KICKOFF.md` says LOCKED; `make fetch` and `make pipeline` refuse to run.
3. `make lint test validate build smoke` pass, or each skipped check is justified in the report.
4. Contract fixtures validate; a copy with a required field removed fails validation.
5. `AGENTS.md` contains all twelve sections; `CLAUDE.md` is 30 lines or fewer and starts with `@AGENTS.md`.
6. Eight skills and the `spec-reviewer` subagent exist with valid front matter and required sections.
7. `scripts/delegate.sh` and `scripts/executor-smoke.sh` exist and fail with a clear message when no executor is configured.
8. `scripts/lane-setup.sh <lane>` generates lane permissions from `scripts/lanes.json`.
9. `git log` contains no secrets, no `.h5`/`.nc` files, no science data.
10. `docs/PHASE0-REPORT.md` lists the human-only TODOs from `docs/05` section 6.
11. Git setup from `docs/05` section 5.8 is in place: `.githooks/commit-msg` rejects `bad message` and accepts `F00: test`; `scripts/commit-reminder.sh` warns on a dirty worktree and exits 0; `.gitattributes` exists.

## Out of scope
Remote repo creation, branch protection, accounts, executor hosting (human steps).

## Edge cases and failure modes
- No network: package installs and CI dry-runs may fail; record and proceed.
- Existing files conflicting with the tree: stop and ask.

## Test plan
Run the checks in section 4 of `docs/05` after each step; final dry run at B13.

## Delegation notes
Mostly Claude-direct (it creates the delegation kit itself). Boilerplate steps (B8, B9 skeletons) can be delegated once the executor smoke test passes.

## Open questions
None.
