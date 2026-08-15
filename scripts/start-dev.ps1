$ErrorActionPreference = "Stop"

Write-Host "Starting the host-development database..."
docker compose -f compose.yaml -f compose.host-dev.yaml up -d --wait postgres
if ($LASTEXITCODE -ne 0) {
  throw "PostgreSQL did not start. Make sure Docker Desktop is running."
}

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgres://shelem:shelem@localhost:5433/shelem"
}

Write-Host "PostgreSQL is ready at localhost:5433."
Write-Host "Starting the web app, game server, and LiveKit..."
$concurrently = Join-Path $PSScriptRoot "..\node_modules\.bin\concurrently.cmd"
if (-not (Test-Path -LiteralPath $concurrently)) {
  throw "Dependencies are not installed. Run npm install first."
}

& $concurrently --kill-others -n "web,game,media" `
  "npm run dev" `
  "node --watch server/index.mjs" `
  "npm run media"
exit $LASTEXITCODE
