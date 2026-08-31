$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$packageLockPath = Join-Path $repositoryRoot "package-lock.json"
$nodeModulesPath = Join-Path $repositoryRoot "node_modules"
$dependencyMarkerPath = Join-Path $nodeModulesPath ".shelem-package-lock.sha256"
$concurrentlyPath = Join-Path $nodeModulesPath ".bin\concurrently.cmd"
$liveKitScriptPath = Join-Path $PSScriptRoot "start-livekit.ps1"

Set-Location -LiteralPath $repositoryRoot

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE."
  }
}

function Test-TcpPort {
  param([int]$Port)

  $client = [Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.ConnectAsync("127.0.0.1", $Port)
    return $connection.Wait(250) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

$requiredPorts = 5173, 3001, 7880, 7881
$occupiedPorts = @($requiredPorts | Where-Object { Test-TcpPort -Port $_ })
if ($occupiedPorts.Count -gt 0) {
  throw "Development ports are already in use: $($occupiedPorts -join ', '). Stop the existing development stack, then try again."
}

Write-Host "Checking development dependencies..."
$packageLockHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $packageLockPath).Hash
$installedHash = if (Test-Path -LiteralPath $dependencyMarkerPath) {
  (Get-Content -LiteralPath $dependencyMarkerPath -Raw).Trim()
} else {
  ""
}
$dependenciesReady =
  $installedHash -eq $packageLockHash -and
  (Test-Path -LiteralPath $concurrentlyPath) -and
  (Test-Path -LiteralPath (Join-Path $nodeModulesPath "three\package.json")) -and
  (Test-Path -LiteralPath (Join-Path $nodeModulesPath "livekit-client\package.json"))

if (-not $dependenciesReady) {
  Write-Host "Dependencies changed. Running npm ci..."
  Invoke-CheckedCommand -Name "npm ci" -Command { & npm ci }
  [IO.File]::WriteAllText($dependencyMarkerPath, $packageLockHash)
} else {
  Write-Host "Dependencies are current."
}

Write-Host "Checking Docker Desktop..."
& docker info --format "{{.ServerVersion}}" *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop is not available. Start Docker Desktop, then run npm run dev:all again."
}

Write-Host "Starting the host-development database..."
Invoke-CheckedCommand -Name "PostgreSQL startup" -Command {
  & docker compose -f compose.yaml -f compose.host-dev.yaml up -d --wait postgres
}

# Local development uses fixed credentials. This prevents an inherited
# production variable from creating tokens that local LiveKit cannot verify.
$env:NODE_ENV = "development"
$env:DATABASE_URL = "postgres://shelem:shelem@localhost:5433/shelem"
$env:LIVEKIT_API_KEY = "devkey"
$env:LIVEKIT_API_SECRET = "secret"
$env:LIVEKIT_KEYS = "devkey: secret"
$env:LIVEKIT_URL = "ws://localhost:7880"

Write-Host "Preparing LiveKit..."
& $liveKitScriptPath -InstallOnly
if ($LASTEXITCODE -ne 0) {
  throw "LiveKit installation failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path -LiteralPath $concurrentlyPath)) {
  throw "The concurrently command is unavailable after dependency installation."
}

Write-Host "Starting LiveKit, the game server, and the web app..."
Write-Host "The web address will appear after all required services are ready."
& $concurrentlyPath --kill-others --names "media,game,web" `
  "npm run media" `
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev-service.ps1 game" `
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev-service.ps1 web"
exit $LASTEXITCODE
