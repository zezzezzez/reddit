# Reddit 监控 - 从 AWS 拉取最新数据
# 用法：本地运行此脚本，获取 AWS 扫描的最新数据

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  从 AWS 拉取最新数据" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 切换到项目目录
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

# 保存当前未提交的变更（如果有）
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "⚠ 检测到未提交的变更，正在暂存..." -ForegroundColor Yellow
    git stash
    Write-Host ""
}

# 拉取最新数据
Write-Host "1. 从 GitHub 拉取最新数据..." -ForegroundColor Yellow
git pull origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================" -ForegroundColor Green
    Write-Host "  拉取成功！" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "数据同步完成，现在本地和 AWS 的数据已保持一致。" -ForegroundColor Cyan
    
    # 检查是否有新的数据文件
    if (Test-Path "data/posts.json") {
        $postsCount = (Get-Content "data/posts.json" | ConvertFrom-Json).Count
        Write-Host "✓ 帖子数据: $postsCount 条" -ForegroundColor Green
    }
    if (Test-Path "data/comments.json") {
        $commentsCount = (Get-Content "data/comments.json" | ConvertFrom-Json).Count
        Write-Host "✓ 评论数据: $commentsCount 条" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "错误: 拉取失败" -ForegroundColor Red
    Write-Host "请检查网络连接或 Git 配置" -ForegroundColor Yellow
}

# 恢复之前暂存的变更（如果有）
if ($gitStatus) {
    Write-Host ""
    Write-Host "恢复之前暂存的变更..." -ForegroundColor Yellow
    git stash pop
}

Write-Host ""
pause
