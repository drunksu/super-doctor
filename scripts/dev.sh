#!/usr/bin/env bash
# Start the whole system locally.
#   Backend  http://127.0.0.1:8000/docs
#   Frontend http://localhost:3000
#   Demo account: demo@mediflow.ai / demo1234
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python="$root/.venv/bin/python"

if [ ! -x "$python" ]; then
  echo "→ creating .venv (Python 3.12)"
  python3 -m venv "$root/.venv"
  "$python" -m pip install -q --upgrade pip
fi

echo "→ installing backend dependencies"
(cd "$root/backend" && "$python" -m pip install -q -e ".[dev]")

if [ ! -f "$root/backend/.env" ]; then
  echo "→ creating .env from .env.example (fill DEEPSEEK_API_KEY to use the live model)"
  cp "$root/backend/.env.example" "$root/backend/.env"
fi

echo "→ starting FastAPI on :8000"
(cd "$root/backend" && "$python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload) &
api_pid=$!
trap 'kill $api_pid 2>/dev/null || true' EXIT

echo "→ installing frontend dependencies"
(cd "$root/frontend" && [ -d node_modules ] || pnpm install)
echo "→ starting Next.js on :3000"
(cd "$root/frontend" && pnpm dev)
