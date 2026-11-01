# Run the evaluation harness: multi-agent pipeline vs single-agent baseline.
#
#   pwsh -File scripts/eval.ps1               # full run (~10 min, ~70k tokens)
#   pwsh -File scripts/eval.ps1 -Limit 6      # quick smoke
#   pwsh -File scripts/eval.ps1 -Only emergency -NoJudge

param(
    [int]$Limit = 0,
    [string]$Only = "",
    [switch]$NoJudge
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"

$args = @("-m", "app.evals.runner", "--delay", "0.25")
if ($Limit -gt 0) { $args += @("--limit", "$Limit") }
if ($Only) { $args += @("--only", $Only) }
if ($NoJudge) { $args += @("--no-judge") }

Push-Location (Join-Path $root "backend")
& $python @args
Pop-Location
