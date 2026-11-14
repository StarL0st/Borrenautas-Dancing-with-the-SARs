# Dancing with the SARs: Spec Package

NASA Space Apps 2026 challenge: build an interactive application that tracks and visualizes surface change using NISAR radar data.

This package contains **specification documents only**. It is the input for a Claude Code build agent, which creates the repository from these specs. Nothing in here is code.

## What is in the package

| File | Purpose |
|---|---|
| `docs/00-challenge.md` | Challenge text (verbatim) and a numbered requirements list (R1-R10) used for traceability |
| `docs/01-product-spec.md` | What we are building, for whom, scope (Must/Should/Could), non-goals |
| `docs/02-architecture.md` | Static-first architecture, default stack, data flow, budgets, fallbacks |
| `docs/03-data-sources.md` | Verified NISAR data access facts, links, things still to verify |
| `docs/04-contracts.md` | Data contracts between pipeline and frontend (the lane boundary) |
| `docs/05-repo-build-spec.md` | **Master spec**: the repo tree and the ordered build steps the build agent executes |
| `docs/06-agent-collaboration-spec.md` | Lanes, git workflow, skills, hooks, usage budget, handoffs |
| `docs/07-qwen-delegation-spec.md` | How Claude Code supervises Qwen3.6-27B as the coding executor |
| `docs/08-demo-and-submission-spec.md` | Demo script, submission checklist, final-hour routine |
| `specs/_template.md` | Feature spec template |
| `specs/F00` to `specs/F07` | Feature specs with testable acceptance criteria |

## How to use it

1. Clone this repo (`docs/` and `specs/` are already in it).
2. Open Claude Code in the clone and paste the kickoff prompt below.
3. The agent builds **Phase 0** (scaffolding), then stops and reports. You review the report.
4. At the official start, a human flips `KICKOFF.md` to `STATUS: GO`. Only then does Phase 1 start (data discovery, pipeline, frontend features).

## Kickoff prompt for the build agent

```
You are the build agent for this repository. Read README.md, then
docs/05-repo-build-spec.md and every file it tells you to read, in the order given.
Execute Phase 0 only.

Rules:
- Do not download or fetch any NISAR or other science data, choose a study area, or
  write analysis or frontend feature code until KICKOFF.md contains "STATUS: GO".
- Work through build steps B0-B14 in order. Commit once per step. Run each step's
  check before moving on.
- If a spec is ambiguous or conflicts with another spec, stop and ask. Do not
  silently choose.
- When Phase 0 is done, write docs/PHASE0-REPORT.md (steps done, checks passed,
  anything skipped or uncertain) and stop.
```

## Phase gate (important)

Space Apps projects are expected to be built during the event. Before the start, the build agent may only create process scaffolding, templates, tooling, CI, empty skeletons, and synthetic labelled fixtures. Data downloads, study-area selection, and feature code are locked behind `KICKOFF.md`. The gate is enforced by a script (`scripts/check_gate.sh`), not just by instruction. Please also read the official rules and confirm this matches them.

## Branches and spec authority

`main` is the ground truth for specs, contracts, and rules, and holds only the working product. Each lane builds and tests on its own branch: `backend` (`pipeline/`) and `frontend` (`web/`). Agents do not modify rule files (`README.md`, `CLAUDE.md`, `docs/`, `specs/`, `contracts/`, `.claude/`) unless a human prompt says so, and never push or merge to `main`. Details: `docs/06-agent-collaboration-spec.md` section 5 and the root `CLAUDE.md`.

## Commit discipline

Commit early and constantly: after every passing check and at least every 30 minutes (`F##: wip ...` is fine), push at least hourly, and never stop a session with uncommitted work. Commit messages need a prefix (`F##:`, `T-###:`, `chore:`, `docs:`, `fix:`, `kickoff:`). Hooks enforce this; run `make setup` once per clone to turn them on. Details: `docs/06-agent-collaboration-spec.md` section 5.

## Things only humans can do (before kickoff)

- Create the GitHub repo, add the three collaborators, protect `main` (require PR and passing CI).
- Each person: clone, then run `make setup` (once Phase 0 exists) so git hooks and config are active.
- Create a NASA Earthdata Login account for each person who will download data.
- Get the executor model endpoint and key (see `docs/07-qwen-delegation-spec.md`), keep the key in a local `.env` only.
- Confirm the local event start time, the submission deadline, and the official submission requirements. Fill them into `docs/08-demo-and-submission-spec.md`.
- Paste the "list of resources provided" from the challenge page into `docs/03-data-sources.md`. It was not part of the pasted challenge text.
