# Documentation

Every document in the repository, in reading order. The numbered files `00` to `10` are the team's specification and status documents; `11` to `13` were added on the `jopa-testing` branch.

## Start here

| Document | Read it to |
|---|---|
| [../README.md](../README.md) | Get the whole picture: what the app does, how to run it, sources, limits |
| [11-user-guide.md](11-user-guide.md) | Learn to use the app, mode by mode |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Work on the code: branches, commit rules, checks |

## The project

| Document | What it holds |
|---|---|
| [00-challenge.md](00-challenge.md) | The challenge text and a numbered list of its requirements (R1-R10) |
| [01-product-spec.md](01-product-spec.md) | What is being built, for whom, scope, non-goals |
| [02-architecture.md](02-architecture.md) | Static-first architecture, stack, data flow, hosting |
| [03-data-sources.md](03-data-sources.md) | NISAR products, maturity levels, access paths, Mexico coverage |
| [04-contracts.md](04-contracts.md) | The data contracts between back end and front end (the lane boundary) |
| [09-references.md](09-references.md) | Every dataset, service, library and font, with license and citation |
| [10-status-log.md](10-status-log.md) | What is built, what is left, the live deployment, and the time log |

## How the team works

| Document | What it holds |
|---|---|
| [05-repo-build-spec.md](05-repo-build-spec.md) | The repository plan and the build steps of Phase 0 |
| [06-agent-collaboration-spec.md](06-agent-collaboration-spec.md) | Lanes, git workflow, commit discipline, handoffs |
| [07-qwen-delegation-spec.md](07-qwen-delegation-spec.md) | How the coding assistant delegates to an executor model |
| [08-demo-and-submission-spec.md](08-demo-and-submission-spec.md) | Demo script, submission checklist, final-hour routine |
| [spec-package.md](spec-package.md) | The original root README of the specification package (kickoff prompt, phase gate) |
| [../specs/](../specs/) | Feature specs F00-F07 with acceptance criteria, and their template |

## Features in depth (`jopa-testing`)

| Document | What it holds |
|---|---|
| [11-user-guide.md](11-user-guide.md) | Using the globe, Simple mode's guide, Technical mode's cards, comparators, reports |
| [12-pdf-reports.md](12-pdf-reports.md) | How the area report is built from a fixed template, versioned and sourced |
| [13-sources-policy.md](13-sources-policy.md) | The rule that every fact has a source, and how to add one |
| [../frontend/DECISIONS.md](../frontend/DECISIONS.md) | Why these data and methods, and what was given up |
| [../frontend/JOPA_TESTING.md](../frontend/JOPA_TESTING.md) | Round-by-round log of the branch |

## Lane notes

| Document | What it holds |
|---|---|
| [../frontend/README.md](../frontend/README.md) | Front-end setup, data addresses, current state, deploy |
| [../frontend/INTEGRATION.md](../frontend/INTEGRATION.md) | A note from the `testing` branch on checking the front end against contract 0.5 |
| [../backend/README.md](../backend/README.md) | Pipeline commands, detection rules, categories, live feeds |
| [../backend/deploy/README.md](../backend/deploy/README.md) | Azure deployment: storage, VM, site, guards, cost |
| [../backend/LIVE_FEEDS_TEST.md](../backend/LIVE_FEEDS_TEST.md) | The live feeds tested against real events |
| [../CHANGELOG.md](../CHANGELOG.md) | What changed and when |
