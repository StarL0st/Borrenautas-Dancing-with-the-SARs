# One image for the API (Cloud Run service) and the batch pipeline (Cloud Run job).
# Build context is the repo root: gcloud builds submit --config deploy/cloudbuild.yaml .
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.13 /uv /usr/local/bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/app/.venv

# Dependencies first so code edits do not reinstall them.
COPY pyproject.toml uv.lock ./
COPY backend/pyproject.toml backend/README.md backend/
RUN uv sync --frozen --no-dev --no-install-workspace --package sars-pipeline

COPY backend backend
RUN uv sync --frozen --no-dev --package sars-pipeline

ARG GIT_COMMIT=unknown
# /data is the Cloud Storage bucket, mounted by Cloud Run (see deploy/gcp.sh).
ENV PATH=/app/.venv/bin:$PATH SARS_DATA_ROOT=/data GIT_COMMIT=$GIT_COMMIT

# Default: the API. The batch job overrides the command with "sars-pipeline run".
CMD ["sh", "-c", "sars-pipeline --data-dir /data/processed serve --host 0.0.0.0 --port ${PORT:-8080} --no-inbox"]
