# Agent rules (binding)

Phase 0 will add `@AGENTS.md` here. Until then these rules apply to every agent.

## Spec authority
- `main` is the ground truth for specs, contracts, rules, and the working product.
- Do NOT modify these unless a human prompt explicitly tells you to: `README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/`, `specs/`, `contracts/`, `.claude/`. If a rule looks wrong, stop and ask.
- Never push or merge to `main`. Humans merge tested, working branch work into `main`.

## Branches
- `backend`: Python pipeline and data server, edits only in `pipeline/` (and gitignored `data/`).
- `frontend`: web app, edits only in `web/`.
- Work only on your lane's branch. Rebase on `main` to pick up rule changes.
- Branch-specific notes go in your lane folder (`pipeline/README.md`, `web/README.md`).

## Interface between lanes
- Backend and frontend meet only at the data contracts in `docs/04-contracts.md`.

## Commits
- Prefix: `F##:`, `T-###:`, `chore:`, `docs:`, `fix:`, `kickoff:`.
- Commit after every passing check and at least every 30 minutes; push your lane branch at least hourly; never stop with uncommitted work. See `docs/06` section 5.
