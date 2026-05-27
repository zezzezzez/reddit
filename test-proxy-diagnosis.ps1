# 测试代理配置
# 在浏览器中打开这个文件来诊断问题

Write-Host "=== Reddit Monitor 代理配置诊断 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 测试服务器基本连接
Write-Host "1. 测试服务器 HTTP 连接..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://63.183.212.153:3000" -UseBasicParsing -TimeoutSec 10
    Write-Host "   ✅ 服务器响应: HTTP $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ 服务器连接失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "可能原因：" -ForegroundColor Yellow
    Write-Host "  - Docker 容器未正常启动" -ForegroundColor White
    Write-Host "  - Next.js 应用启动失败" -ForegroundColor White  
    Write-Host "  - 代理配置导致应用崩溃" -ForegroundColor White
    Write-Host ""
    Write-Host "建议操作：" -ForegroundColor Cyan
    Write-Host "  1. SSH 到服务器检查容器状态" -ForegroundColor White
    Write-Host "  2. 查看容器日志: docker logs reddit-monitor" -ForegroundColor White
    Write-Host "  3. 如果代理有问题，回滚到之前版本" -ForegroundColor White
    exit 1
}

# 2. 测试 API 连通性
Write-Host ""
Write-Host "2. 测试 API 连通性..." -ForegroundColor Yellow
try {
    $conn = Invoke-RestMethod -Uri "http://63.183.212.153:3000/api/connectivity" -TimeoutSec 10
    Write-Host "   连通性: $($conn.message)" -ForegroundColor $(if ($conn.connected) { "Green" } else { "Red" })
} catch {
    Write-Host "   ❌ API 调用失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. 测试帖子 API
Write-Host ""
Write-Host "3. 测试帖子 API..." -ForegroundColor Yellow
try {
    $posts = (Invoke-RestMethod -Uri "http://63.183.212.153:3000/api/posts" -TimeoutSec 10).posts
    Write-Host "   ✅ 帖子数量: $($posts.Count)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ 帖子 API 失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 诊断完成 ===" -ForegroundColor Cyan
