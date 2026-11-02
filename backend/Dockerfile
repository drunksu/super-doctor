FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first so code changes do not invalidate the layer cache.
COPY pyproject.toml ./
RUN mkdir -p app && pip install --no-cache-dir .

COPY app ./app
COPY tests ./tests

RUN mkdir -p /data
ENV DATABASE_URL="sqlite+aiosqlite:////data/super-doctor.db"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
