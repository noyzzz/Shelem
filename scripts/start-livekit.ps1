param(
  [switch]$InstallOnly
)

$ErrorActionPreference = "Stop"

$version = "1.13.1"
$archiveName = "livekit_$($version)_windows_amd64.zip"
$downloadBase = "https://github.com/livekit/livekit/releases/download/v$version"
$installDirectory = Join-Path $env:LOCALAPPDATA "Shelem\livekit\$version"
$archivePath = Join-Path $installDirectory $archiveName
$serverPath = Join-Path $installDirectory "livekit-server.exe"

if (-not (Test-Path -LiteralPath $serverPath)) {
  New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null
  Write-Host "Downloading LiveKit $version..."
  Invoke-WebRequest -UseBasicParsing -Uri "$downloadBase/$archiveName" -OutFile $archivePath

  $checksumResponse = Invoke-WebRequest -UseBasicParsing -Uri "$downloadBase/checksums.txt"
  $checksumText = [Text.Encoding]::UTF8.GetString($checksumResponse.Content)
  $checksumLine = $checksumText -split "`n" |
    Where-Object { $_ -match [regex]::Escape($archiveName) } |
    Select-Object -First 1
  if (-not $checksumLine) {
    throw "LiveKit checksum was not found."
  }

  $expectedChecksum = ($checksumLine.Trim() -split "\s+")[0].ToUpperInvariant()
  $actualChecksum = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash
  if ($actualChecksum -ne $expectedChecksum) {
    throw "LiveKit download failed checksum verification."
  }

  Expand-Archive -LiteralPath $archivePath -DestinationPath $installDirectory -Force
}

if ($InstallOnly) {
  Write-Host "LiveKit $version is installed."
  exit 0
}

$nodeIp = $env:LIVEKIT_NODE_IP
if (-not $nodeIp) {
  $defaultRoute = Get-NetRoute -DestinationPrefix "0.0.0.0/0" |
    Sort-Object RouteMetric, InterfaceMetric |
    Select-Object -First 1
  if ($defaultRoute) {
    $nodeIp = Get-NetIPAddress -InterfaceIndex $defaultRoute.InterfaceIndex -AddressFamily IPv4 |
      Where-Object { $_.AddressState -eq "Preferred" } |
      Select-Object -ExpandProperty IPAddress -First 1
  }
}
if (-not $nodeIp) {
  $nodeIp = "127.0.0.1"
}

Write-Host "Starting LiveKit on ws://localhost:7880 (media address $nodeIp)"
& $serverPath --dev --bind 0.0.0.0 --node-ip $nodeIp --udp-port 7882
