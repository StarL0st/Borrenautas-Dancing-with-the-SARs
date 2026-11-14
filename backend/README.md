# Backend (lane 1): sars-pipeline

Python backend, managed with [uv](https://docs.astral.sh/uv/). Rebuilding from the ground up, starting with the data pull (`src/sars_pipeline/data_pull.py`).

```
cd backend
uv sync                                        # create backend/.venv from uv.lock
uv run python -m sars_pipeline.data_pull       # run the data pull
uv add <package>                               # add a dependency (never pip install)
```

Use `backend/.venv` as the editor's Python interpreter. Downloads go under `<repo>/data/` (gitignored).
