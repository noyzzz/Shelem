param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("game", "web")]
  [string]$Service
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $repositoryRoot

function Wait-ForTcpPort {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [int]$TimeoutSeconds = 60
  )

  Write-Host "Waiting for $Name on port $Port..."
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    $client = [Net.Sockets.TcpClient]::new()
    try {
      $connection = $client.ConnectAsync("127.0.0.1", $Port)
      if ($connection.Wait(500) -and $client.Connected) {
        Write-Host "$Name is ready on port $Port."
        return
      }
    } catch {
      # The service is still starting.
    } finally {
      $client.Dispose()
    }
    Start-Sleep -Milliseconds 250
  }

  throw "$Name did not open port $Port within $TimeoutSeconds seconds."
}

if ($Service -eq "game") {
  Wait-ForTcpPort -Name "LiveKit" -Port 7880
  & node --watch server/index.mjs
  exit $LASTEXITCODE
}

Wait-ForTcpPort -Name "LiveKit" -Port 7880
Wait-ForTcpPort -Name "The game server" -Port 3001
& npm run dev
exit $LASTEXITCODE
