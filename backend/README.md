# Backend (lane 1): sars-pipeline

Python backend, managed with [uv](https://docs.astral.sh/uv/) as a member of the repo's uv workspace (root `pyproject.toml`). There is one shared `.venv` and `uv.lock` at the repo root; VS Code picks up `.venv` automatically.

```
uv sync                                      # from anywhere in the repo: create/update .venv
cd backend && uv add <package>               # add a dependency to the backend
uv add --package sars-pipeline <package>     # same, from the repo root
uv run python -m sars_pipeline.data_pull     # run the data pull
```

- Never use `pip install` or `uv pip install`: they skip `pyproject.toml` and `uv.lock`, so the package vanishes on the next `uv sync`.
- Secrets (Earthdata login) go in `backend/.env`, which is gitignored. Load them with `python-dotenv`.
- Downloads go under `<repo>/data/` (gitignored).
