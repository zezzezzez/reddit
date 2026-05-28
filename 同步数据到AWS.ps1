# Reddit 监控 - 本地扫描并同步到 AWS
# 用法：在本地完成扫描后，运行此脚本同步数据到 AWS

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  数据同步工具" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Git
$gitVersion = git --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 未检测到 Git，请先安装 Git" -ForegroundColor Red
    pause
    exit
}
Write-Host "✓ Git 版本: $gitVersion" -ForegroundColor Green

# 切换到项目目录
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host "✓ 项目目录: $projectDir" -ForegroundColor Green
Write-Host ""

# 检查数据文件
$dataFiles = @("data/posts.json", "data/comments.json", "data/scans.json", "data/config.json")
$hasData = $false

foreach ($file in $dataFiles) {
    if (Test-Path $file) {
        $fileSize = (Get-Item $file).Length
        Write-Host "✓ $file ($([math]::Round($fileSize/1KB, 2)) KB)" -ForegroundColor Green
        $hasData = $true
    } else {
        Write-Host "✗ $file (不存在)" -ForegroundColor Yellow
    }
}

if (-not $hasData) {
    Write-Host ""
    Write-Host "错误: 未找到数据文件，请先在本地完成扫描" -ForegroundColor Red
    pause
    exit
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  开始同步数据到 GitHub" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 添加数据文件到 Git
Write-Host "1. 添加数据文件..." -ForegroundColor Yellow
git add data/posts.json data/comments.json data/scans.json data/config.json data/reports.json 2>$null

# 检查是否有变更
$gitStatus = git status --porcelain
if ($gitStatus -match "data/") {
    # 提交变更
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMsg = "同步本地扫描数据 - $timestamp"
    
    Write-Host "2. 提交变更..." -ForegroundColor Yellow
    git commit -m $commitMsg
    
    # 推送到 GitHub
    Write-Host "3. 推送到 GitHub..." -ForegroundColor Yellow
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "================================" -ForegroundColor Green
        Write-Host "  同步成功！" -ForegroundColor Green
        Write-Host "================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "数据已推送到 GitHub，AWS 将在 1-2 分钟内自动部署更新。" -ForegroundColor Cyan
        Write-Host "访问地址: http://63.183.212.153:3000" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "错误: 推送失败" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "没有需要同步的数据变更" -ForegroundColor Yellow
}

Write-Host ""
pause
