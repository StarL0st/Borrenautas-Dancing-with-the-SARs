# The backend image. Build context is the repo root (see backend/deploy/compose.yaml).
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
# /data is mounted from the host (compose.yaml): selections, cached windows, outputs.
ENV PATH=/app/.venv/bin:$PATH SARS_DATA_ROOT=/data GIT_COMMIT=$GIT_COMMIT

# SARS_SERVE_FLAGS (compose.yaml): --jobs turns on POST /sites, --public opens place lookup.
CMD ["sh", "-c", "sars-pipeline --data-dir /data/processed serve --host 0.0.0.0 --port ${PORT:-8080} --no-inbox ${SARS_SERVE_FLAGS:-}"]
