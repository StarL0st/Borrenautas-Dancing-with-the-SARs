# 07. Qwen Delegation Spec

How Claude Code (planner and reviewer) hands implementation work to Qwen3.6-27B (executor) and keeps the work spec-compliant.

## 1. Principle

Claude owns the **what** and the **verdict**: specs, task briefs, contract decisions, review, integration. Qwen owns bulk **how**: implementing a narrowly scoped, fully specified task. Accountability never moves: a human reviews every PR, and Claude reviews every executor result before it reaches a PR.

## 2. What we know about the executor (verified during spec preparation)

- Qwen3.6-27B is a dense 27B open-weights model from Alibaba under Apache 2.0, aimed at agentic coding. Native context 262,144 tokens. The vendor reports 77.2 on SWE-bench Verified and 59.3 on Terminal-Bench 2.0; treat these as vendor numbers, not a guarantee on our code.
- Hosted listings may cap context far below native (one provider listing showed 32k). **Confirm the context length of the endpoint we actually use.**
- Qwen Code is an open-source terminal agent. It runs headless with `-p` (or piped input), authenticates headlessly via OpenAI-compatible environment variables (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`), and reads project config from `.qwen/settings.json` and `.qwen/.env`. OAuth login does not work in headless runs. Verify flags with `qwen --help`; do not rely on this document for exact flag names.
- The model ID string differs between providers. Record the exact ID in ADR-006.

## 3. Topology

```
Lane agent (Claude Code, in its worktree)
   |  1. writes tasks/briefs/T-###.md
   |  2. make delegate TASK=T-###
   v
scripts/delegate.sh  -->  Qwen Code (headless, OpenAI-compatible endpoint)
   |  runs in the same worktree, on the task branch
   v
tasks/results/T-###/RESULT.md + diff on the branch + test output
   |  3. Claude reads RESULT.md, diff stat, test output
   |  4. review-against-spec  -> merge candidate, retry, or escalate
```

Default (Option A): CLI executor invoked by script per task, one task at a time per lane, at most two concurrent executor jobs overall (endpoint rate limits).

Not the default (Option C): pointing Claude Code itself at Qwen through an Anthropic-compatible gateway. Untested; try only after Phase 1 is stable and only for one lane.

## 4. What to delegate

| Delegate to the executor | Keep with Claude |
|---|---|
| Implementing a task from an approved spec with exact acceptance criteria | Writing and changing specs, contracts, ADRs |
| Unit tests for specified behavior | Study-area and method decisions (SAR science judgment) |
| Boilerplate, glue code, format converters, CLI wrappers | Reviewing executor output |
| UI components with a defined contract and fixtures | Integration and cross-lane debugging |
| Refactors inside one lane with tests in place | Anything touching secrets, auth, or deployment |
| Docs and comments from existing code | Anything ambiguous or under-specified |

Rule of thumb: if Claude cannot write the acceptance criteria as checkable statements, it is not ready to delegate.

## 5. Task brief (`tasks/briefs/_template.md`)

A brief is self-contained: the executor sees no chat history. Target 30 to 90 minutes of work and no more than about five files changed.

```
# T-### <title>
Spec: F## (criteria copied verbatim below)   Branch: <lane>/F##-<desc>   Lane: <lane>
## Goal
(1-3 sentences)
## Allowed to edit (write)
(explicit paths)
## Read only (context)
(explicit paths: contracts, fixtures, related modules)
## Inputs and contracts
(which schema/fixture; exact function signatures or file names expected)
## Steps
(numbered, at most 8)
## Acceptance criteria (verbatim from spec)
1. ...
## Commands that must pass
make lint ; make test ; make validate
## Constraints
No new dependencies. No network access. No secrets. No files outside "Allowed to edit".
Do not change tests or criteria to make them pass. If blocked, stop and say why.
## Previous attempt feedback
(empty on first run; specific, minimal corrections on retries)
## Output required
Write RESULT.md: what changed (files), commands run and their results, evidence for each
criterion, open questions/blockers. Commit on the branch with the message "F##: <summary> [executor]".
```

## 6. Execution protocol

States: `BRIEFED` -> `RUNNING` -> `GATE` -> `REVIEW` -> `MERGE-CANDIDATE`, with `RETRY` (max 2) and `ESCALATE`.

1. **Brief.** Claude writes the brief from the approved spec. It does not paste whole files, only paths.
2. **Run.** `make delegate TASK=T-###` runs `scripts/delegate.sh` (see 7).
3. **Gate.** The script runs `make lint test validate` and the path guard. Failures go to `RETRY` without involving Claude's review budget beyond reading the failure.
4. **Review.** Claude reads, in this order: `RESULT.md`, `git diff --stat`, test output. Only then the diff itself, using `review-against-spec` (or the `spec-reviewer` subagent for large diffs).
5. **Decide.**
   - All criteria pass with evidence: open a PR (template marks "Executor-generated: yes, brief T-###"), human reviews and merges.
   - Fails: add concise, specific feedback to "Previous attempt feedback" and retry. Maximum two retries.
   - Still failing, or the brief itself was wrong: **escalate.** Claude implements the task itself or rewrites the spec. Do not loop a third time.
6. **Log.** Append a row to `tasks/results/runs.csv`: task, lane, model, duration, passed first time (y/n), retries, escalated (y/n).

## 7. `scripts/delegate.sh` requirements

- Argument: task ID. Fails with a clear message if the brief is missing, the gate-dependent task is gated, or no executor is configured (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` or equivalent in the git-ignored `.qwen/.env`).
- **Minimal environment:** run the executor with an allowlisted environment (PATH, HOME, executor variables). Earthdata credentials, GitHub tokens, and any other secrets are not passed.
- Runs headless (`qwen -p` with the brief as the prompt) inside the current worktree, with a maximum run time (default 20 minutes) and a turn/step limit if the CLI offers one.
- **Path guard:** after the run, compare changed files (`git diff --name-only` against the branch base) to the brief's "Allowed to edit" list. Any file outside it fails the run and is reported; nothing is auto-merged.
- Captures stdout/stderr to `tasks/results/T-###/run.log` (git-ignored) and requires `RESULT.md`.
- Never pushes. Pushing and PRs are done by the lane agent or the human.

## 8. Executor context file

Provide the executor a short project context file (`QWEN.md` or the CLI's equivalent; verify the name with the CLI docs) that holds only: the lane rule, the exact commands, "do not change tests or criteria to pass", "stop and write blockers in RESULT.md instead of guessing", and the commit message format. Under 40 lines. Smaller models follow short, concrete rules better than long prose.

## 9. Endpoint setup and smoke test (do before Phase 1 depends on it)

`scripts/executor-smoke.sh` runs a trivial brief (add a pure function and its unit test in a scratch branch) end to end. It must show:

- [ ] Headless run completes and `RESULT.md` is produced
- [ ] Tool calling and file edits work (agent loops break on small format mismatches)
- [ ] Gate passes (`make lint test`)
- [ ] Context length of the endpoint is known and large enough for the briefs
- [ ] Latency per task is acceptable, rate limits are known, cost is noted
- [ ] A deliberate out-of-lane edit is caught by the path guard

Hosting options (decide in ADR-006): a hosted API that serves the model (set `OPENAI_BASE_URL` to its endpoint), or a team GPU box serving an OpenAI-compatible endpoint with vLLM or SGLang. A 27B dense model needs serious GPU memory at full precision; quantized builds run on less with some quality loss. Test before the event, not during.

## 10. Fallback rules

- If the first six delegated tasks pass first time less than 60 percent of the time, or average latency makes the executor slower than Claude doing the task itself, switch that lane to Claude-only implementation. Executor stays available for tests and boilerplate.
- If the endpoint is down, switch immediately; do not wait. Note it in the handoff.

## 11. Current deployment decision (record as ADR-006)

The executor is served through **one team member's personal OpenRouter key**. The key is not shared. Consequences:

- **One executor, one machine.** Only the key owner's lane agent can delegate. The other two lanes are Claude-only, and `make delegate` on their machines fails with the "no executor configured" message. Skills and agents must treat delegation as optional (see `delegate-to-executor`).
- **Configuration (local only, git-ignored `.qwen/.env`):**
  - `OPENAI_API_KEY` = the OpenRouter key
  - `OPENAI_BASE_URL` = `https://openrouter.ai/api/v1`
  - `OPENAI_MODEL` = `qwen/qwen3.6-27b` (OpenRouter's listing at the time of writing: context 262,144 tokens, about $0.25 input / $2 output per million tokens headline, six providers with differing prices and uptime)
- **Verify, do not assume:** the OpenRouter page did not confirm tool calling, so the smoke test (section 9) must prove tool calling and file edits through the chosen provider. Providers differ in uptime and price; if results are inconsistent, pin or restrict provider routing in OpenRouter settings and record the choice.
- **Cost control:** set a credit limit on the key (if the dashboard offers one), and review spend after the first day.
- **Privacy:** prompts go to whichever third-party provider serves the request. Check the account's privacy and data-policy settings. Only repository code and public NASA data may be sent; never credentials.
- **Never** commit the key, put it in `.qwen/settings.json`, paste it in chat, or pass it to other lanes. `delegate.sh` passes only the `OPENAI_*` variables.
- **Optional, to use the executor for a teammate's task:** the teammate writes the brief and pushes the branch; the key owner checks it out, runs `make delegate`, and pushes the result for review. Use only for well-sliced tasks, because it adds coordination cost.
- **Fallback:** if the key owner is rate-limited, out of credit, or the endpoint is down, the lane switches to Claude-only immediately (section 10).

## 12. Privacy and cost

- The endpoint is third-party. It receives only repository code and public NASA data. No credentials, no personal data.
- Claude's tokens go to briefs, reviews, and hard problems; the executor absorbs bulk generation. Claude reads `RESULT.md` before diffs to keep review cheap.
