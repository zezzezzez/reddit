@echo off
echo ====================================
echo Starting Reddit Monitor Dev Server
echo With Optimized Memory Settings
echo ====================================
echo.

REM 设置 Node.js 最大内存为 4GB
set NODE_OPTIONS=--max-old-space-size=4096

REM 启动开发服务器
npm run dev

pause
