# Contributing

How to work on G.I.G.A.S. The binding rules are the team's: the root [CLAUDE.md](CLAUDE.md) and [docs/06-agent-collaboration-spec.md](docs/06-agent-collaboration-spec.md) (section 5). This page puts them together with the checks and conventions the code relies on.

## Branches and lanes

| Branch | Holds | Who changes it |
|---|---|---|
| `main` | The ground truth: specs, contracts, rules and the working product | Humans only, by merging tested branch work. Never push or merge to `main` from a working branch |
| `backend` | The pipeline and data server (`backend/`, `data/`) | The back-end lane |
| `frontend` | The web app (`frontend/`) | The front-end lane |
| `testing`, `testing-frontend`, `mobile` | Trying lanes together; phone layout | As named |
| `jopa-testing` and other personal branches | One person's work | Its owner; pushed only to itself |

- Work only on your lane's branch and only in its folder; branch notes go in the lane's README (`frontend/README.md`, `backend/README.md`).
- The lanes meet **only at the data contracts** ([docs/04-contracts.md](docs/04-contracts.md)). A contract change is a docs change first, agreed by both lanes.
- Rule files (`README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/`, `specs/`, `contracts/`, `.claude/`) change only when a human asks for it.

## Commits

- **Prefix every message:** `F##:` (the feature spec, see `specs/`), `T-###:`, `chore:`, `docs:`, `fix:`, `kickoff:`. Example: `F04: before/after comparator with zoom`.
- **Commit often:** after every passing check and at least every 30 minutes; `F##: wip ...` is fine. Push your branch at least hourly, and never stop with uncommitted work.
- **One subject per commit**, written so a teammate understands what changed and why.

## Checks before you push

**Front end** (Node.js 22.18 or newer):

```bash
cd frontend
npm ci
npx tsc --noEmit -p .       # types
npm test                    # unit tests (logic, live feeds, comparator, reports, texts, sources)
npm run build               # type-check + production build
```

**Back end** (uv, Python 3.12):

```bash
cd backend
uv run pytest
uv run ruff check .
```

The GitHub workflow in `.github/workflows/ci.yml` runs the same checks on pull requests and when started by hand.

## Conventions

### Facts and sources

Nothing is stated without a real source, preferably NASA. Read [docs/13-sources-policy.md](docs/13-sources-policy.md) before adding any explanation, glossary entry, decision or fact: add the source to `frontend/src/sources.ts`, cite it in the item's `refs`, and write only what the page says. The app's own thresholds cite the code. Tests check that every explanation cites a known source.

### Data on screen

- Every piece of data carries its source badge (`frontend/src/origin.ts`): NISAR radar, other satellite, live report or published record, with its date.
- Nothing synthetic is ever shown as real; example places and test data are labelled.
- A failed load never becomes "no data": keep the last good data and say so.

### Texts and languages

- Every interface text lives in `frontend/src/i18n.ts` in English, Spanish and German, with the same keys and the same `{placeholders}` (a test checks this).
- Longer texts (explanations, kids' guide, zone notes, decisions, report wording) are `{ en, es }`; German falls back to English.
- Plain language: short sentences, everyday words; the Simple-mode guide is written so a 10-year-old can follow it.

### Code

- TypeScript, plain DOM (`el()` in `frontend/src/ui.ts`, never HTML strings), no UI framework.
- Pure logic in modules without DOM imports (`logic.ts`, `compare-core.ts`, `report-core.ts`, `pdf-text.ts`, `sources.ts`, ...) so `node --test` can run it; tests in `frontend/test/`.
- Keep `main.ts` thin where possible: add features as their own modules.
- Accessibility: keyboard use, labels for screen readers, color never alone, reduced motion respected.
- Network calls have time limits; long work (reports) runs in the background and never blocks a click.

### The area report

The report is a fixed template filled with data ([docs/12-pdf-reports.md](docs/12-pdf-reports.md)). Keep every section's data in the snapshot (so versions stay correct), keep the `EN` and `ES` wording in step, and open a report in the app to check the layout after a change.

### The decision log

Edit `frontend/src/decisions.ts`, then run `npm run decisions` in `frontend/` to regenerate `frontend/DECISIONS.md`.

## Issues and pull requests

- Use the templates in `.github/`: bug, feature, or **wrong or unsourced information** (for any fact that looks wrong or lacks a source).
- One spec or task per pull request; say which checks you ran and paste their result; one human review is enough.
- Rebase on `main` before opening a pull request to `main`.
