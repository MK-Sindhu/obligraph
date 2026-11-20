FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:0.11.4 /uv /usr/local/bin/uv
WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN uv sync --frozen --no-dev
ENV PATH="/app/.venv/bin:$PATH"

RUN useradd --create-home obligraph && mkdir -p /data && chown obligraph /data
ENV STORAGE_DIR=/data
USER obligraph
EXPOSE 8000
CMD ["uvicorn", "obligraph.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
