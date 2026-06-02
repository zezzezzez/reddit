# Reddit Monitor 开发服务器启动脚本
# 自动清理旧进程并启动新服务器

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Reddit Monitor 开发服务器启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 步骤 0: 防止重复启动
Write-Host "🔍 步骤 0: 检查服务器是否已在运行..." -ForegroundColor Yellow

$existingServer = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | 
    Where-Object { $_.State -eq 'Listen' }

if ($existingServer) {
    Write-Host "  ⚠️  服务器已在运行（端口 3000 被占用）" -ForegroundColor Red
    Write-Host "  进程 PID: $($existingServer.OwningProcess)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  选项:" -ForegroundColor Yellow
    Write-Host "  1. 如果服务器正常工作，请直接访问 http://localhost:3000" -ForegroundColor Gray
    Write-Host "  2. 如需重启，请先关闭现有服务器（Ctrl+C），然后重新运行此脚本" -ForegroundColor Gray
    Write-Host ""
    $choice = Read-Host "  是否强制关闭并重启？(y/N)"
    
    if ($choice -ne 'y' -and $choice -ne 'Y') {
        Write-Host "  已取消启动" -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "  正在强制关闭现有服务器..." -ForegroundColor Yellow
    Stop-Process -Id $existingServer.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}

Write-Host ""

# 步骤 1: 检查并清理残留的 Node 进程
Write-Host "🔍 步骤 1: 检查残留的 Node 进程..." -ForegroundColor Yellow

$nodes = Get-Process node -ErrorAction SilentlyContinue

if ($nodes) {
    Write-Host "  发现 $($nodes.Count) 个 Node 进程，正在清理..." -ForegroundColor Red
    
    # 只清理与当前项目相关的进程（通过命令行参数判断）
    $cleanedCount = 0
    foreach ($node in $nodes) {
        try {
            # 尝试获取进程的命令行
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($node.Id)").CommandLine
            if ($cmdLine -match 'reddit-monitor|next\.js|next dev') {
                Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue
                $cleanedCount++
            }
        } catch {
            # 忽略无法访问的进程
        }
    }
    
    if ($cleanedCount -gt 0) {
        Write-Host "  已清理 $cleanedCount 个相关进程" -ForegroundColor Yellow
    } else {
        Write-Host "  未发现相关进程，跳过清理" -ForegroundColor Green
    }
    
    Write-Host "  等待进程完全清理..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    # 验证是否清理成功
    $remainingNodes = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
            $cmdLine -match 'reddit-monitor|next\.js|next dev'
        } catch {
            $false
        }
    }
    
    if ($remainingNodes) {
        Write-Host "  ⚠️  警告: 仍有 $($remainingNodes.Count) 个相关进程未清理" -ForegroundColor Yellow
        Write-Host "  建议: 打开任务管理器手动结束 node.exe 进程" -ForegroundColor Gray
        Start-Sleep -Seconds 2
    } else {
        Write-Host "  ✅ 所有旧进程已清理" -ForegroundColor Green
    }
} else {
    Write-Host "  ✅ 没有发现残留进程" -ForegroundColor Green
}

Write-Host ""

# 步骤 2: 检查端口 3000 是否可用
Write-Host "🔍 步骤 2: 检查端口 3000..." -ForegroundColor Yellow

$portInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | 
    Where-Object { $_.State -eq 'Listen' }

if ($portInUse) {
    Write-Host "  ❌ 错误: 端口 3000 仍被占用，请手动检查" -ForegroundColor Red
    Write-Host "  运行命令: netstat -ano | findstr :3000" -ForegroundColor Gray
    exit 1
}

Write-Host "  ✅ 端口 3000 可用" -ForegroundColor Green
Write-Host ""

# 步骤 3: 启动开发服务器
Write-Host "🚀 步骤 3: 启动开发服务器..." -ForegroundColor Green
Write-Host ""

# 切换到项目目录
Set-Location "c:\Users\Administrator\Desktop\reddit-monitor"

# 验证项目目录
$dotfiles = Test-Path "package.json"
if (-not $dotfiles) {
    Write-Host "❌ 错误: 未找到 package.json，请在正确的项目目录运行此脚本" -ForegroundColor Red
    exit 1
}

Write-Host "📁 项目目录: $(Get-Location)" -ForegroundColor Cyan
Write-Host "📦 使用 Turbopack 模式（更快速、更少内存占用）" -ForegroundColor Cyan
Write-Host ""

# 设置环境变量
$env:NODE_OPTIONS = "--max-old-space-size=4096"

# 启动开发服务器（保持前台运行）
Write-Host "========================================" -ForegroundColor Green
Write-Host "  服务器正在启动，请稍候..." -ForegroundColor Green
Write-Host "  访问地址: http://localhost:3000" -ForegroundColor Green
Write-Host "  按 Ctrl+C 停止服务器" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 使用 Turbopack（更稳定，不会创建大量进程）
npm run dev
