# 05. Repo Build Spec (master spec for the build agent)

This is the spec the build agent executes. It describes the repository to create, the order to build it in, and the checks that prove each step is done.

## 1. Phase gate

| Phase | When | Allowed |
|---|---|---|
| **Phase 0: scaffolding** | Now (before the event) | Docs, specs, agent config, skills, tooling, CI, empty package skeletons, contract schemas, synthetic labelled fixtures, a hello-world toolchain check |
| **Phase 1: build** | After a human sets `STATUS: GO` in `KICKOFF.md` | Study-area selection, data downloads, pipeline, analysis, frontend features, story content |

While `KICKOFF.md` says `STATUS: LOCKED`, the build agent must not: download science data, choose a study area, write change-detection code, or build frontend features. `scripts/check_gate.sh` enforces this for `make fetch` and `make pipeline`.

## 2. Read order

1. `README.md`
2. `docs/00-challenge.md`
3. `docs/01-product-spec.md`
4. `docs/02-architecture.md`
5. `docs/03-data-sources.md`
6. `docs/04-contracts.md`
7. `docs/06-agent-collaboration-spec.md`
8. `docs/07-qwen-delegation-spec.md`
9. `docs/08-demo-and-submission-spec.md`
10. `specs/_template.md`, then `specs/F00` to `specs/F07`

## 3. Target repository tree

```
/
├── README.md                       # repo README (team, run, workflow); replaces this package's README
├── LICENSE                         # per ADR-005 (placeholder until decided)
├── KICKOFF.md                      # phase gate
├── CLAUDE.md                       # short; imports AGENTS.md
├── AGENTS.md                       # rules for every agent
├── Makefile
├── .gitignore
├── .gitattributes                  # LF for *.sh, *.py, Makefile (Windows clones)
├── .githooks/commit-msg            # enforces commit prefix (docs/06 section 5)
├── .env.example                    # variable names only
├── .claude/
│   ├── settings.json               # shared permissions + hooks
│   ├── skills/
│   │   ├── implement-spec/SKILL.md
│   │   ├── write-spec/SKILL.md
│   │   ├── review-against-spec/SKILL.md
│   │   ├── handoff/SKILL.md
│   │   ├── integration-check/SKILL.md
│   │   ├── data-source-notes/SKILL.md
│   │   ├── delegate-to-executor/SKILL.md
│   │   └── demo-prep/SKILL.md
│   └── agents/spec-reviewer.md     # read-only reviewer subagent
├── .qwen/
│   └── settings.json               # executor CLI config template, no secrets
├── .github/
│   ├── pull_request_template.md
│   └── workflows/ci.yml
├── docs/
│   ├── 00 ... 08 (from this package)
│   ├── ownership.md
│   ├── decisions/ADR-000-template.md, ADR-001 ... ADR-006 (stubs)
│   └── PHASE0-REPORT.md            # written by the build agent at the end
├── specs/                          # _template.md, F00 ... F07
├── tasks/
│   ├── BOARD.md
│   ├── briefs/_template.md         # executor task brief template
│   ├── handoffs/                   # handoff notes
│   └── results/                    # executor run outputs (RESULT.md, runs.csv)
├── contracts/
│   ├── schemas/                    # manifest, layer, timeseries, story (draft 2020-12)
│   └── fixtures/                   # synthetic examples, always "synthetic": true
├── backend/                        # uv project (Lane 1): pyproject.toml, uv.lock
│   ├── pyproject.toml
│   ├── src/sars_pipeline/          # discover, fetch, extract, normalize, change, export (stubs)
│   └── tests/
├── frontend/                       # Vite + TypeScript app (Lane 2)
│   ├── package.json, vite.config.ts, tsconfig.json
│   ├── src/                        # toolchain check only in Phase 0
│   └── public/data/                # pipeline output lands here
├── data/
│   ├── raw/                        # gitignored
│   ├── interim/                    # gitignored
│   └── samples/                    # small committed samples
└── scripts/
    ├── check_gate.sh
    ├── lanes.json                  # lane -> owned paths (single source of truth)
    ├── lane-setup.sh               # writes per-worktree lane permissions
    ├── new-worktree.sh
    ├── delegate.sh                 # runs the executor (see docs/07)
    ├── executor-smoke.sh
    ├── post-edit.sh                # hook: fast lint of the edited file
    ├── commit-reminder.sh          # hook: warn on uncommitted/unpushed/stale work
    └── validate-contracts.py
```

## 4. Build steps

Commit after each step. Each step has a check; do not proceed until it passes. If a check cannot run (for example, no network for package installs), record that in `docs/PHASE0-REPORT.md` and continue with what can be verified.

| Step | Do | Check |
|---|---|---|
| **B0** | Initialize git on `main` (if needed). Create `.gitignore` (see 5.6), `.gitattributes` (`* text=auto eol=lf`), and `.githooks/commit-msg` (5.8); run the git config lines from 5.8. | `git status` clean after commit; a commit with message `bad message` is rejected |
| **B1** | Confirm `docs/` and `specs/` from the package are present. Verify every file referenced in this document exists. | A listing of referenced vs present files shows no gaps |
| **B2** | Create `KICKOFF.md` (`STATUS: LOCKED`) and `scripts/check_gate.sh` (see 5.1). | Script exits non-zero on LOCKED, zero on GO (test both by temporarily editing, then restoring) |
| **B3** | Write `AGENTS.md` and `CLAUDE.md` (see 5.2). | `AGENTS.md` has every required section; `CLAUDE.md` is 30 lines or fewer |
| **B4** | Write `Makefile` (5.3), `.env.example`, `scripts/new-worktree.sh`, `scripts/lanes.json`, `scripts/lane-setup.sh`, `docs/ownership.md` (from `docs/06`). | `make help` lists targets; `lane-setup.sh frontend` generates a valid settings file in a temp worktree |
| **B5** | Create `contracts/schemas/*.schema.json` from `docs/04`, synthetic fixtures, and `scripts/validate-contracts.py`. | `make validate` passes on fixtures; fails when a required field is removed from a fixture copy |
| **B6** | Create `.claude/settings.json`, `scripts/post-edit.sh`, the eight skills, and the `spec-reviewer` subagent per `docs/06`. | Each `SKILL.md` has valid front matter (`name`, `description`) and the sections listed in `docs/06`; settings JSON parses |
| **B7** | Create the delegation kit: `.qwen/settings.json` template, `tasks/briefs/_template.md`, `scripts/delegate.sh`, `scripts/executor-smoke.sh`, `tasks/results/` per `docs/07`. | `bash -n` passes on scripts; `delegate.sh` with no executor configured exits with a clear message |
| **B8** | Create the `backend/` skeleton: `pyproject.toml`, package with stub modules and docstrings only, one test that imports the package. | `make lint` and `make test` pass for the pipeline |
| **B9** | Create the `frontend/` skeleton: Vite + TypeScript + MapLibre toolchain check that renders a map container and loads the synthetic fixture manifest, nothing more. | `make build` succeeds; `make smoke` passes |
| **B10** | Create `.github/workflows/ci.yml` and `pull_request_template.md` (5.4). | Workflow YAML parses; every job is guarded so it passes on the empty skeleton |
| **B11** | Create `tasks/BOARD.md` seeded from `specs/` (5.5) and `docs/decisions/` ADR stubs (ADR-000 template, ADR-001 to ADR-006). | Every spec appears on the board with a status |
| **B12** | Write the repo `README.md` (what it is, how to run, team workflow, gate explanation). | Fresh reader can find: setup, run, test, workflow, gate |
| **B13** | Dry run: `make lint test validate smoke`; run `scripts/executor-smoke.sh` only if an executor is configured. | All pass, or the skip reason is recorded |
| **B14** | Write `docs/PHASE0-REPORT.md`: steps done, checks passed, deviations, open questions, human TODO list. Stop. | Report exists; no uncommitted changes |

## 5. File requirements

### 5.1 `KICKOFF.md` and `scripts/check_gate.sh`

`KICKOFF.md`:

```
STATUS: LOCKED

# Kickoff gate
Change the first line to "STATUS: GO" only at the official start of the hackathon.
This is a human edit. Commit message: "kickoff: GO".

LOCKED allows: docs, specs, tooling, CI, skeletons, synthetic fixtures.
GO unlocks: data download, study-area selection, pipeline, analysis, frontend features.
```

`check_gate.sh`: reads the first line of `KICKOFF.md`; exit 0 only if it is exactly `STATUS: GO`; otherwise print a one-line explanation and exit 1.

### 5.2 `AGENTS.md` and `CLAUDE.md`

`AGENTS.md` (aim for 120 lines or fewer; short, concrete, imperative) must contain these sections:

1. **Mission**: three lines (challenge, product, static-first).
2. **Gate rule**: check `KICKOFF.md`; if LOCKED, stay in Phase 0 work.
3. **Read order**: `docs/00` to `docs/04`, then your assigned spec.
4. **Commands**: the exact `make` targets and what each does.
5. **Lanes and ownership**: pointer to `docs/ownership.md`; edit only your lane's paths.
6. **Source of truth**: specs and contracts win over code; flag mismatches in the PR, never silently fix either side. `main` is the ground truth; agents do not modify rule files (`README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/`, `specs/`, `contracts/`, `.claude/`) unless a human prompt explicitly directs it (`docs/06` section 5). Keep the existing root `CLAUDE.md` rules when rewriting it.
7. **Contracts**: frozen after the freeze time; change protocol from `docs/04`.
8. **Definition of done**: acceptance criteria met with evidence, `make lint test validate` pass, spec status updated, PR template completed.
9. **Git rules**: branch naming, commit prefix with spec ID, commit cadence (commit after every passing check and at least every 30 minutes, push at least hourly, never stop with uncommitted work; see `docs/06` section 5), never push to `main`, one task per PR, rebase on `main` before opening a PR.
10. **Delegation**: optional, and only on a machine where an executor is configured (`make delegate` tells you); when and how to use it (pointer to `docs/07`); executor output is never merged without review.
11. **Usage hygiene**: fresh session per task, read specific files not whole directories, write a handoff when stopping or near a limit.
12. **Never**: commit secrets or data files, rewrite acceptance criteria, add dependencies without noting them in the PR, show synthetic data as real, claim results beyond the data's maturity.

`CLAUDE.md`: 30 lines or fewer. Starts with `@AGENTS.md`. Adds only Claude Code specifics: the skills list and when each applies, use plan mode before writing a spec, check `/status` at each integration check.

### 5.3 `Makefile` targets

| Target | Behavior |
|---|---|
| `help` | List targets |
| `setup` | Apply the git config from 5.8; `uv sync` in `backend/`; `npm ci` in `frontend/` |
| `lint` | ruff (pipeline) and ESLint/Prettier check (web) |
| `test` | pytest and Vitest |
| `validate` | Run `scripts/validate-contracts.py` over fixtures and `frontend/public/data/` |
| `build` | Production build of `frontend/` |
| `dev` | Run the web dev server |
| `smoke` | Build, then verify the built site's manifest validates and the page entry point exists |
| `gate` | Run `scripts/check_gate.sh` |
| `fetch` | **Gated.** Download granules (implemented in F02) |
| `pipeline` | **Gated.** Run the full pipeline (implemented in F02/F03) |
| `sync-data` | Copy validated pipeline outputs into `frontend/public/data/` |
| `worktree` | `make worktree LANE=<lane> NAME=<branch>` calls `scripts/new-worktree.sh` |
| `delegate` | `make delegate TASK=T-001` calls `scripts/delegate.sh` |

### 5.4 CI and PR template

CI (`.github/workflows/ci.yml`), on pull requests and pushes to `main`:

- `gate-file`: `KICKOFF.md` exists and its first line is `STATUS: LOCKED` or `STATUS: GO`.
- `contracts`: `make validate`.
- `pipeline`: ruff and pytest, skipped cleanly if `backend/` is absent.
- `web`: `npm ci`, lint, test, build, skipped cleanly if `frontend/` is absent.
- `smoke`: `make smoke`.
- Pin Python (3.12, via uv) and Node (20).

PR template fields: Spec ID; Lane; Summary; Acceptance criteria table (criterion, evidence); How it was tested; Screenshots (UI changes); Out-of-lane edits (none or list); New dependencies (none or list); Contract change (yes/no, and approvals); Executor-generated (yes/no, brief ID); Reviewer checklist.

### 5.5 `tasks/BOARD.md`

A table: ID, title, spec, lane, status (`LOCKED`, `READY`, `IN PROGRESS`, `IN REVIEW`, `DONE`), owner, branch, notes. Seed one row per spec: F00 is `READY`; F01 to F07 are `LOCKED` until the gate opens. Add a "Usage" section with one line per person for tracking plan headroom.

### 5.6 `.gitignore`

Must ignore: `.env`, `.env.*` (but not `.env.example`), `data/raw/`, `data/interim/`, `*.h5`, `*.nc`, `*.tif`/`*.tiff` (with explicit exceptions for `data/samples/` and `contracts/fixtures/`), `node_modules/`, `.venv/`, `dist/`, `__pycache__/`, `.pytest_cache/`, `.claude/settings.local.json`, `.qwen/.env`, `tasks/results/*.log`.

### 5.7 `.claude/settings.json`

- Permissions (express with Claude Code's permission rule syntax; verify with `/permissions`): allow `make`, read-only git commands, `git add`, `git commit`, `git switch`, `git worktree`, `git rebase`, test runners and `npm run`. Deny reading `.env` and `.env.*`, deny reading `data/raw/**`, deny `git push` to `main`, deny force-push, deny recursive deletes.
- Hooks: a post-edit hook running `scripts/post-edit.sh` (fast lint of the edited file only, under 10 s, never blocks on style); a session-start hook printing gate status, the current lane, and a stale-commit warning (last commit older than 30 minutes, or unpushed commits); a stop hook (`scripts/commit-reminder.sh`) that warns when there are uncommitted changes or unpushed commits. Both commit warnings never block.
- Per-lane edit restrictions are generated into the git-ignored `.claude/settings.local.json` by `scripts/lane-setup.sh <lane>`, which reads `scripts/lanes.json` and denies edits to every path the lane does not own.

### 5.8 Git setup and commit enforcement

Git config applied by B0 and by `make setup` (idempotent, local to the clone):

```
git config core.hooksPath .githooks
git config pull.rebase true
git config rebase.autoStash true
git config push.autoSetupRemote true
```

`.githooks/commit-msg` (POSIX sh, executable, LF): accept a first line matching `^(F[0-9]{2}|T-[0-9]{3}|chore|docs|fix|kickoff): .+`, also accept git's own `Merge ` and `Revert ` messages; otherwise print the expected format and exit 1.

`scripts/commit-reminder.sh`: print a reminder if `git status --porcelain` is non-empty or the branch is ahead of its upstream; print a warning if the last commit is older than 30 minutes. Always exit 0.

## 6. Human-only steps (the build agent must list these in the report, not attempt them)

- Create the remote repository, add collaborators, enable branch protection on `main` (require PR and passing CI).
- Create Earthdata Login accounts; place credentials in local `.env`.
- Obtain the executor endpoint and key; place them in local `.env`.
- Confirm event times and official submission requirements; update `docs/08`.
- Flip `KICKOFF.md` to `STATUS: GO` at the start.

## 7. Phase 0 acceptance checklist

- [ ] All files in the tree exist (or the report explains why not)
- [ ] `make gate` fails while LOCKED; `make fetch` and `make pipeline` refuse to run while LOCKED
- [ ] `make lint test validate build smoke` pass, or skipped checks are justified in the report
- [ ] Contract fixtures validate; a broken copy fails
- [ ] `AGENTS.md` has all twelve sections; `CLAUDE.md` is 30 lines or fewer
- [ ] Eight skills and the reviewer subagent exist with valid front matter
- [ ] `delegate.sh` and `executor-smoke.sh` exist and fail clearly when no executor is configured
- [ ] `commit-msg` hook active (`git config core.hooksPath` is `.githooks`) and rejects a bad message; stop hook warns on uncommitted changes
- [ ] No secrets, no data files, no science data in the commit history
- [ ] `docs/PHASE0-REPORT.md` lists human TODOs

## 8. After GO

Work proceeds spec by spec from `tasks/BOARD.md`, starting with F01. See `docs/06-agent-collaboration-spec.md` for lanes, cadence, and freezes.
