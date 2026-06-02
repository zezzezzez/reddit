# Reddit Monitor 进程清理工具
# 专门用于清理与本项目相关的所有 Node 进程

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Reddit Monitor 进程清理工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 步骤 1: 检查端口 3000 占用情况
Write-Host "🔍 步骤 1: 检查端口 3000 占用情况..." -ForegroundColor Yellow

$portUsers = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | 
    Where-Object { $_.State -eq 'Listen' -or $_.State -eq 'Established' }

if ($portUsers) {
    Write-Host "  发现 $($portUsers.Count) 个连接使用端口 3000" -ForegroundColor Red
    foreach ($conn in $portUsers) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  - PID: $($conn.OwningProcess), 进程: $($proc.ProcessName), 内存: $([math]::Round($proc.WorkingSet64/1MB, 2)) MB" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  ✅ 端口 3000 未被占用" -ForegroundColor Green
}

Write-Host ""

# 步骤 2: 查找并清理相关 Node 进程
Write-Host "🔍 步骤 2: 查找与 Reddit Monitor 相关的 Node 进程..." -ForegroundColor Yellow

$projectNodes = @()
$allNodes = Get-Process node -ErrorAction SilentlyContinue

if ($allNodes) {
    Write-Host "  总共发现 $($allNodes.Count) 个 Node 进程，正在筛选..." -ForegroundColor Yellow
    
    foreach ($node in $allNodes) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($node.Id)").CommandLine
            # 匹配与项目相关的进程
            if ($cmdLine -match 'reddit-monitor|next\.js|next dev|node-cron') {
                $projectNodes += @{
                    Process = $node
                    CommandLine = $cmdLine
                }
            }
        } catch {
            # 忽略无法访问的进程
        }
    }
}

if ($projectNodes.Count -gt 0) {
    Write-Host "  发现 $($projectNodes.Count) 个相关进程" -ForegroundColor Red
    Write-Host ""
    
    # 显示进程详情
    Write-Host "  进程详情:" -ForegroundColor Yellow
    foreach ($item in $projectNodes) {
        $proc = $item.Process
        $memMB = [math]::Round($proc.WorkingSet64/1MB, 2)
        $cpuSec = [math]::Round($proc.CPU, 2)
        Write-Host "  - PID: $($proc.Id), 内存: ${memMB} MB, CPU: ${cpuSec}s" -ForegroundColor Gray
        
        # 显示部分命令行（截断到 80 字符）
        $cmdDisplay = $item.CommandLine
        if ($cmdDisplay.Length -gt 80) {
            $cmdDisplay = $cmdDisplay.Substring(0, 80) + "..."
        }
        Write-Host "    命令: $cmdDisplay" -ForegroundColor DarkGray
    }
    
    Write-Host ""
    $choice = Read-Host "  是否清理这些进程？(y/N)"
    
    if ($choice -eq 'y' -or $choice -eq 'Y') {
        Write-Host ""
        Write-Host "  正在清理进程..." -ForegroundColor Yellow
        
        $cleanedCount = 0
        foreach ($item in $projectNodes) {
            try {
                Stop-Process -Id $item.Process.Id -Force -ErrorAction SilentlyContinue
                $cleanedCount++
            } catch {
                Write-Host "  ⚠️  无法清理 PID $($item.Process.Id): $_" -ForegroundColor Yellow
            }
        }
        
        Write-Host ""
        Write-Host "  ✅ 已清理 $cleanedCount 个进程" -ForegroundColor Green
        
        # 等待进程完全退出
        Write-Host "  等待进程完全退出..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        
        # 验证清理结果
        $remainingNodes = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
            try {
                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
                $cmdLine -match 'reddit-monitor|next\.js|next dev|node-cron'
            } catch {
                $false
            }
        }
        
        if ($remainingNodes.Count -gt 0) {
            Write-Host "  ⚠️  警告: 仍有 $($remainingNodes.Count) 个相关进程未清理" -ForegroundColor Yellow
            Write-Host "  建议: 打开任务管理器手动结束这些进程" -ForegroundColor Gray
        } else {
            Write-Host "  ✅ 所有相关进程已清理完毕" -ForegroundColor Green
        }
    } else {
        Write-Host "  已取消清理操作" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✅ 未发现相关进程" -ForegroundColor Green
}

Write-Host ""

# 步骤 3: 检查清理结果
Write-Host "🔍 步骤 3: 最终检查..." -ForegroundColor Yellow

$finalPortCheck = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | 
    Where-Object { $_.State -eq 'Listen' }

if ($finalPortCheck) {
    Write-Host "  ⚠️  端口 3000 仍被占用" -ForegroundColor Red
    Write-Host "  建议: 手动运行 'netstat -ano | findstr :3000' 查看占用进程" -ForegroundColor Gray
} else {
    Write-Host "  ✅ 端口 3000 已释放" -ForegroundColor Green
}

$finalNodeCount = (Get-Process node -ErrorAction SilentlyContinue).Count
Write-Host "  当前 Node 进程总数: $finalNodeCount" -ForegroundColor $(if ($finalNodeCount -gt 10) { 'Red' } else { 'Green' })

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  清理完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Read-Host "按 Enter 键退出"
