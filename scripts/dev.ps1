# Start the whole system locally.
#
#   pwsh -File scripts/dev.ps1          (Windows)
#   ./scripts/dev.sh                    (macOS / Linux)
#
# Backend  http://127.0.0.1:8000/docs
# Frontend http://localhost:3000
# Demo account: demo@superdoctor.ai / demo1234

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "→ creating .venv (Python 3.12)" -ForegroundColor Cyan
    python -m venv (Join-Path $root ".venv")
    & $python -m pip install -q --upgrade pip
}

Write-Host "→ installing backend dependencies" -ForegroundColor Cyan
Push-Location (Join-Path $root "backend")
& $python -m pip install -q -e ".[dev]"

if (-not (Test-Path ".env")) {
    Write-Host "→ creating .env from .env.example (fill DEEPSEEK_API_KEY to use the live model)" -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

Write-Host "→ starting FastAPI on :8000" -ForegroundColor Cyan
$api = Start-Process -FilePath $python -ArgumentList "-m","uvicorn","app.main:app","--host","127.0.0.1","--port","8000","--reload" -PassThru -WindowStyle Hidden
Pop-Location

Write-Host "→ installing frontend dependencies" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
if (-not (Test-Path "node_modules")) { pnpm install }
Write-Host "→ starting Next.js on :3000" -ForegroundColor Cyan
pnpm dev
Pop-Location

if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force }
