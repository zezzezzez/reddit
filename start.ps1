$cfPath = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe"
$projectDir = "c:\Users\Administrator\Desktop\reddit-monitor"
$configFile = "$projectDir\data\config.json"
$nextConfigFile = "$projectDir\next.config.ts"

Write-Host "=== Reddit Monitor Starting ===" -ForegroundColor Cyan

Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "[1/3] Starting Cloudflare tunnel..." -ForegroundColor Yellow
$tunnelLog = "$env:TEMP\cf_tunnel.txt"
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

$tunnelProcess = Start-Process -FilePath $cfPath -ArgumentList "tunnel --url http://localhost:3000" -RedirectStandardError $tunnelLog -PassThru -WindowStyle Hidden

$tunnelUrl = $null
$timeout = 30
for ($i = 0; $i -lt $timeout; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
        $content = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
        if ($content -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
            $tunnelUrl = $Matches[0]
            break
        }
    }
}

if ($tunnelUrl) {
    Write-Host "[OK] Tunnel URL: $tunnelUrl" -ForegroundColor Green
    $config = Get-Content $configFile -Raw | ConvertFrom-Json
    $config | Add-Member -NotePropertyName "tunnelUrl" -NotePropertyValue $tunnelUrl -Force
    $config | ConvertTo-Json -Depth 10 | Set-Content $configFile -Encoding UTF8
    Write-Host "[OK] Config updated" -ForegroundColor Green
    $domain = $tunnelUrl -replace 'https://', ''
    $nc = Get-Content $nextConfigFile -Raw
    $nc = $nc -replace "allowedDevOrigins: \[.*?\]", "allowedDevOrigins: ['10.31.131.24', '$domain']"
    Set-Content $nextConfigFile $nc -Encoding UTF8
    Write-Host "[OK] allowedDevOrigins updated" -ForegroundColor Green
} else {
    Write-Host "[WARN] Could not get tunnel URL" -ForegroundColor Red
}

Write-Host "[2/3] Starting Next.js server..." -ForegroundColor Yellow
Write-Host ""
if ($tunnelUrl) {
    Write-Host ">>> Public URL: $tunnelUrl <<<" -ForegroundColor Green
}
Write-Host ""
Set-Location $projectDir
npx next dev -H 0.0.0.0
