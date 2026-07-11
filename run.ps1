param(
  [switch]$Dev,
  [switch]$Prod
)

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -LiteralPath $scriptPath

$Host.UI.RawUI.WindowTitle = "Hubly - Ticket System"

function Write-Color($text, $color = "White") {
  Write-Host $text -ForegroundColor $color
}

function Open-Browser($url) {
  try { Start-Process $url } catch {}
}

Clear-Host

Write-Color @"

  ╔══════════════════════════════════════════╗
  ║           Hubly — Ticket System          ║
  ║        One-Click Launcher v2.0           ║
  ╚══════════════════════════════════════════╝

"@ "Cyan"

# Setup .env
if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
  Write-Color "  [✓] Created .env from .env.example" "Green"
}

# Setup node_modules
if (-not (Test-Path "node_modules")) {
  Write-Color "  [i] Installing dependencies..." "Yellow"
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Color "  [✗] npm install failed!" "Red"
    Read-Host "`nPress Enter to exit"
    exit 1
  }
  Write-Color "  [✓] Dependencies installed" "Green"
}

# Setup data directories
@("data\uploads", "data\logs") | ForEach-Object {
  if (-not (Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
}

# Read port from .env
$port = "3000"
if (Test-Path ".env") {
  $envContent = Get-Content ".env" -Raw
  if ($envContent -match '(?m)^PORT=(.+)$') { $port = $Matches[1].Trim() }
}

# Detect if npm run dev (concurrently) is available
$hasConcurrently = (Get-Content "package.json" -Raw) -match '"concurrently"'

if ($Dev) {
  Write-Color "`n  ─── Starting in Development Mode ───" "Cyan"
  Write-Color "  Frontend : http://localhost:5173" "Green"
  Write-Color "  Backend  : http://localhost:$port" "Green"
  Write-Color "  Starting both servers...`n" "Cyan"
  Start-Sleep 2
  Open-Browser "http://localhost:5173"
  npm run dev
  exit 0
}
elseif ($Prod) {
  Write-Color "`n  ─── Starting in Production Mode ───" "Cyan"
  Write-Color "  Building...`n" "Yellow"
  npm run build
  if ($LASTEXITCODE -ne 0) {
    Write-Color "  [✗] Build failed!" "Red"
    Read-Host "`nPress Enter to exit"
    exit 1
  }
  $url = "http://localhost:$port"
  $env:NODE_ENV = "production"
  Write-Color "`n  App running at: $url`n" "Green"
  Open-Browser $url
  node src/backend/server.js
  exit 0
}

# Interactive menu
Write-Color @"

  ┌─────────────────────────────────────────┐
  │   Select Mode:                          │
  │                                         │
  │   [1] Start (Development)               │
  │       - Hot reload frontend + backend   │
  │       - Opens at localhost:5173         │
  │                                         │
  │   [2] Start (Production)                │
  │       - Builds + serves                 │
  │       - Opens at localhost:PORT         │
  │                                         │
  │   [3] Exit                              │
  └─────────────────────────────────────────┘

"@ "Cyan"

$choice = Read-Host "  Select (1-3)"
switch ($choice) {
  "1" {
    Clear-Host
    Write-Color "  Starting in Development Mode..." "Cyan"
    Write-Color "  Frontend : http://localhost:5173" "Green"
    Write-Color "  Backend  : http://localhost:$port" "Green"
    Start-Sleep 2
    Open-Browser "http://localhost:5173"
    npm run dev
  }
  "2" {
    Clear-Host
    Write-Color "  Starting in Production Mode..." "Cyan"
    Write-Color "  Building...`n" "Yellow"
    npm run build
    $env:NODE_ENV = "production"
    $url = "http://localhost:$port"
    Write-Color "`n  App running at: $url`n" "Green"
    Open-Browser $url
    node src/backend/server.js
  }
  "3" { exit 0 }
  default {
    Write-Color "  Invalid choice!" "Red"
    Read-Host "`nPress Enter to exit"
  }
}

Read-Host "`nPress Enter to exit"
