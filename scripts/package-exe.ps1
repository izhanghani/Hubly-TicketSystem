$ErrorActionPreference = "Stop"
$rootDir = Resolve-Path "$PSScriptRoot/.."
$electronDir = "$rootDir/node_modules/electron/dist"
$outDir = "$rootDir/release/IT Ticket System Pro"
$exeName = "IT Ticket System Pro.exe"

Write-Host "Packaging IT Ticket System Pro..." -ForegroundColor Cyan

if (!(Test-Path $electronDir/electron.exe)) {
    Write-Host "ERROR: Electron not found at $electronDir" -ForegroundColor Red
    Write-Host "Run 'npm install' first." -ForegroundColor Red
    exit 1
}

# Create output directory
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
New-Item -ItemType Directory -Path "$outDir/resources" -Force | Out-Null

# Copy Electron runtime files (exe + dlls)
Write-Host "Copying Electron runtime..." -ForegroundColor Yellow
Copy-Item "$electronDir/electron.exe" "$outDir/$exeName" -Force
Get-ChildItem $electronDir -Filter "*.dll" | Copy-Item -Destination $outDir -Force
Get-ChildItem $electronDir -Filter "*.pak" | Copy-Item -Destination $outDir -Force
Get-ChildItem $electronDir -Filter "*.dat" | Copy-Item -Destination $outDir -Force
Get-ChildItem $electronDir -Filter "*.bin" | Copy-Item -Destination $outDir -Force
if (Test-Path $electronDir/locales) {
    Copy-Item "$electronDir/locales" "$outDir/locales" -Recurse -Force
}
if (Test-Path $electronDir/resources) {
    Copy-Item "$electronDir/resources" "$outDir/resources" -Force
}

# Create app.asar directory (app code)
$appDir = "$outDir/resources/app"
New-Item -ItemType Directory -Path $appDir -Force | Out-Null

# Copy app files
Write-Host "Copying app files..." -ForegroundColor Yellow
Copy-Item "$rootDir/package.json" "$appDir/package.json" -Force
Copy-Item "$rootDir/dist" "$appDir/dist" -Recurse -Force
Copy-Item "$rootDir/src/backend" "$appDir/src/backend" -Recurse -Force
Copy-Item "$rootDir/src/electron" "$appDir/src/electron" -Recurse -Force
Copy-Item "$rootDir/data" "$appDir/data" -Recurse -Force

# Copy node_modules (production only)
Write-Host "Copying node_modules (production)..." -ForegroundColor Yellow
$modules = @("bcryptjs", "cors", "express", "express-rate-limit", "helmet", "jsonwebtoken", 
             "multer", "nodemailer", "activedirectory2", "uuid", "socket.io", "xlsx", "sql.js")
foreach ($mod in $modules) {
    $src = "$rootDir/node_modules/$mod"
    $dst = "$appDir/node_modules/$mod"
    if (Test-Path $src) {
        $null = New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force
        Copy-Item $src $dst -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Copy sql.js WASM file
$wasmFiles = Get-ChildItem "$rootDir/node_modules/sql.js/dist/*.wasm" -ErrorAction SilentlyContinue
foreach ($wasm in $wasmFiles) {
    Copy-Item $wasm.FullName "$appDir/node_modules/sql.js/dist/" -Force
}

Write-Host "" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Green
Write-Host "Package created: $outDir/$exeName" -ForegroundColor Green
Write-Host "Size: $((Get-Item "$outDir/$exeName").Length / 1MB) MB" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Run '$outDir/$exeName' to start the app." -ForegroundColor White
