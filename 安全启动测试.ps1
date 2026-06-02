# Reddit Monitor 安全启动测试
# 启动服务器并实时监控进程数量

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Reddit Monitor 安全启动测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 步骤 1: 清理现有进程
Write-Host "🔍 步骤 1: 清理现有进程..." -ForegroundColor Yellow

$existingNodes = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    try {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
        $cmdLine -match 'reddit-monitor|next\.js|next dev'
    } catch {
        $false
    }
}

if ($existingNodes.Count -gt 0) {
    Write-Host "  发现 $($existingNodes.Count) 个相关进程，正在清理..." -ForegroundColor Red
    foreach ($node in $existingNodes) {
        Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 3
    Write-Host "  ✅ 已清理" -ForegroundColor Green
} else {
    Write-Host "  ✅ 无需清理" -ForegroundColor Green
}

Write-Host ""

# 步骤 2: 记录初始进程数
$initialNodeCount = (Get-Process node -ErrorAction SilentlyContinue).Count
Write-Host "📊 当前系统 Node 进程总数: $initialNodeCount" -ForegroundColor Cyan
Write-Host ""

# 步骤 3: 启动服务器（后台运行）
Write-Host "🚀 步骤 3: 启动服务器（后台模式）..." -ForegroundColor Yellow

Set-Location "c:\Users\Administrator\Desktop\reddit-monitor"
$env:NODE_OPTIONS = "--max-old-space-size=4096"

# 在后台启动服务器
$job = Start-Job -ScriptBlock {
    Set-Location "c:\Users\Administrator\Desktop\reddit-monitor"
    $env:NODE_OPTIONS = "--max-old-space-size=4096"
    & npm run dev
} -Name "RedditMonitor"

Write-Host "  服务器正在启动..." -ForegroundColor Yellow
Write-Host ""

# 步骤 4: 监控进程数量（30秒）
Write-Host "📈 步骤 4: 监控进程数量（30秒）..." -ForegroundColor Yellow
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
    
    Write-Host "  [$elapsed秒] Node 进程: $currentCount 个 (新增: +$newProcessCount)" -ForegroundColor $color
    
    # 如果进程数超过阈值，自动停止
    if ($newProcessCount -gt 50) {
        Write-Host ""
        Write-Host "  ⚠️  警告: 新增进程超过 50 个！" -ForegroundColor Red
        Write-Host "  正在自动停止服务器..." -ForegroundColor Yellow
        
        Stop-Job -Job $job
        Remove-Job -Job $job -Force
        
        # 清理进程
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
        
        Write-Host "  ✅ 服务器已停止，进程已清理" -ForegroundColor Green
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "  ⚠️  测试失败: 进程数过多" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  监控结果" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  初始进程数: $initialNodeCount" -ForegroundColor Gray
Write-Host "  最大进程数: $maxProcessCount" -ForegroundColor $(if ($maxProcessCount -gt ($initialNodeCount + 20)) { 'Red' } else { 'Green' })
Write-Host "  新增进程数: $($maxProcessCount - $initialNodeCount)" -ForegroundColor $(if ($maxProcessCount - $initialNodeCount -gt 20) { 'Red' } else { 'Green' })
Write-Host ""

if ($maxProcessCount -le ($initialNodeCount + 10)) {
    Write-Host "✅ 测试通过! 进程数量正常" -ForegroundColor Green
    Write-Host ""
    Write-Host "服务器当前状态:" -ForegroundColor Cyan
    
    # 检查服务器是否正常运行
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ 服务器正常运行 (http://localhost:3000)" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⚠️  服务器可能还在启动中..." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "选项:" -ForegroundColor Yellow
    Write-Host "  1. 继续使用当前服务器（按 1）" -ForegroundColor Gray
    Write-Host "  2. 停止服务器（按 2）" -ForegroundColor Gray
    Write-Host ""
    
    $choice = Read-Host "  请选择 (1/2)"
    
    if ($choice -eq '2') {
        Write-Host "  正在停止服务器..." -ForegroundColor Yellow
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
        
        Write-Host "  ✅ 服务器已停止" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "  服务器将继续运行在后台" -ForegroundColor Green
        Write-Host "  访问地址: http://localhost:3000" -ForegroundColor Green
        Write-Host "  如需停止，运行: 清理进程.bat" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  测试警告: 进程数偏多" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  正在停止服务器..." -ForegroundColor Yellow
    
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
    
    Write-Host "  ✅ 服务器已停止，进程已清理" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  测试完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Read-Host "按 Enter 键退出"
