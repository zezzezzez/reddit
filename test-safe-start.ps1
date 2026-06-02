# Reddit Monitor Safe Start Test
# Monitor process count during startup

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Reddit Monitor Safe Start Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean existing processes
Write-Host "[Step 1] Cleaning existing processes..." -ForegroundColor Yellow

$existingNodes = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    try {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
        $cmdLine -match 'reddit-monitor|next\.js|next dev'
    } catch {
        $false
    }
}

if ($existingNodes.Count -gt 0) {
    Write-Host "  Found $($existingNodes.Count) processes, cleaning..." -ForegroundColor Red
    foreach ($node in $existingNodes) {
        Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 3
    Write-Host "  [OK] Cleaned" -ForegroundColor Green
} else {
    Write-Host "  [OK] No cleanup needed" -ForegroundColor Green
}

Write-Host ""

# Step 2: Record initial count
$initialNodeCount = (Get-Process node -ErrorAction SilentlyContinue).Count
Write-Host "[Step 2] Initial Node processes: $initialNodeCount" -ForegroundColor Cyan
Write-Host ""

# Step 3: Start server in background
Write-Host "[Step 3] Starting server (background mode)..." -ForegroundColor Yellow

Set-Location "c:\Users\Administrator\Desktop\reddit-monitor"
$env:NODE_OPTIONS = "--max-old-space-size=4096"

$job = Start-Job -ScriptBlock {
    Set-Location "c:\Users\Administrator\Desktop\reddit-monitor"
    $env:NODE_OPTIONS = "--max-old-space-size=4096"
    & npm run dev
} -Name "RedditMonitor"

Write-Host "  Server starting..." -ForegroundColor Yellow
Write-Host ""

# Step 4: Monitor for 30 seconds
Write-Host "[Step 4] Monitoring processes (30 seconds)..." -ForegroundColor Yellow
Write-Host ""

$maxProcessCount = 0
$monitoringTime = 30
$checkInterval = 2

for ($i = 0; $i -lt ($monitoringTime / $checkInterval); $i++) {
    Start-Sleep -Seconds $checkInterval
    
    $currentNodes = Get-Process node -ErrorAction SilentlyContinue
    $currentCount = $currentNodes.Count
    $newProcessCount = $currentCount - $initialNodeCount
    
    if ($currentCount -gt $maxProcessCount) {
        $maxProcessCount = $currentCount
    }
    
    $elapsed = ($i + 1) * $checkInterval
    $color = if ($newProcessCount -gt 20) { 'Red' } 
             elseif ($newProcessCount -gt 10) { 'Yellow' } 
             else { 'Green' }
    
    Write-Host "  [${elapsed}s] Node processes: $currentCount (new: +$newProcessCount)" -ForegroundColor $color
    
    # Auto-stop if too many processes
    if ($newProcessCount -gt 50) {
        Write-Host ""
        Write-Host "  [WARNING] Too many processes detected (>$50)!" -ForegroundColor Red
        Write-Host "  Auto-stopping server..." -ForegroundColor Yellow
        
        Stop-Job -Job $job
        Remove-Job -Job $job -Force
        
        $relatedNodes = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
            try {
                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
                $cmdLine -match 'reddit-monitor|next\.js|next dev'
            } catch {
                $false
            }
        }
        
        foreach ($node in $relatedNodes) {
            Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue
        }
        
        Write-Host "  [OK] Server stopped and cleaned" -ForegroundColor Green
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "  [FAIL] Test failed: Too many processes" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Results" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Initial: $initialNodeCount" -ForegroundColor Gray
Write-Host "  Maximum: $maxProcessCount" -ForegroundColor $(if ($maxProcessCount -gt ($initialNodeCount + 20)) { 'Red' } else { 'Green' })
Write-Host "  New: $($maxProcessCount - $initialNodeCount)" -ForegroundColor $(if ($maxProcessCount - $initialNodeCount -gt 20) { 'Red' } else { 'Green' })
Write-Host ""

if ($maxProcessCount -le ($initialNodeCount + 10)) {
    Write-Host "[PASS] Test passed! Process count is normal" -ForegroundColor Green
    Write-Host ""
    Write-Host "Server status:" -ForegroundColor Cyan
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "  [OK] Server running at http://localhost:3000" -ForegroundColor Green
        }
    } catch {
        Write-Host "  [WARN] Server may still be starting..." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  1. Keep server running (press 1)" -ForegroundColor Gray
    Write-Host "  2. Stop server (press 2)" -ForegroundColor Gray
    Write-Host ""
    
    $choice = Read-Host "  Select (1/2)"
    
    if ($choice -eq '2') {
        Write-Host "  Stopping server..." -ForegroundColor Yellow
        Stop-Job -Job $job
        Remove-Job -Job $job -Force
        
        $relatedNodes = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
            try {
                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
                $cmdLine -match 'reddit-monitor|next\.js|next dev'
            } catch {
                $false
            }
        }
        
        foreach ($node in $relatedNodes) {
            Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue
        }
        
        Write-Host "  [OK] Server stopped" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "  Server will continue running in background" -ForegroundColor Green
        Write-Host "  URL: http://localhost:3000" -ForegroundColor Green
        Write-Host "  To stop: run cleanup.bat" -ForegroundColor Gray
    }
} else {
    Write-Host "[WARN] Test warning: Process count is high" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Stopping server..." -ForegroundColor Yellow
    
    Stop-Job -Job $job
    Remove-Job -Job $job -Force
    
    $relatedNodes = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
            $cmdLine -match 'reddit-monitor|next\.js|next dev'
        } catch {
            $false
        }
    }
    
    foreach ($node in $relatedNodes) {
        Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "  [OK] Server stopped and cleaned" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to exit"
