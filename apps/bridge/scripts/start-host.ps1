$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "../../..")
Set-Location $projectRoot
pnpm start:agent-deck
