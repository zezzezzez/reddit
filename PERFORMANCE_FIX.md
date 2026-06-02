# 🔧 Reddit Monitor 性能问题修复指南

## 🚨 问题诊断

### 根本原因
1. **超过 100 个 Node 进程同时运行** - 之前多次启动未正确清理
2. **comments.json 文件过大 (972KB)** - 每次读取都占用大量内存
3. **缓存 TTL 过短 (5秒)** - 导致频繁读取大文件
4. **Turbopack 内存泄漏** - Windows 环境下的已知问题

### 性能影响
- CPU 占用率: **100%**
- 内存占用率: **98%**
- 系统响应: **极其卡顿**

---

## ✅ 已实施的修复

### 1. 清理残留 Node 进程
```powershell
# 方法 1: 使用任务管理器
# 打开任务管理器 -> 详细信息 -> 结束所有 node.exe 进程

# 方法 2: 使用命令行
taskkill /F /IM node.exe
```

### 2. 优化缓存机制
**文件**: `src/lib/store.ts`
- **修改前**: `CACHE_TTL = 5000` (5秒)
- **修改后**: `CACHE_TTL = 30000` (30秒)
- **效果**: 减少 83% 的文件读取次数

### 3. 数据文件优化
已创建清理脚本:
- `cleanup-data.js` - 清理过期数据
- `compress-comments.js` - 压缩评论文件

### 4. 移除 Turbopack
**文件**: `next.config.ts`
- 已移除 turbopack 配置
- 使用稳定的 Webpack 构建工具

---

## 🚀 正确启动步骤

### 步骤 1: 清理所有 Node 进程
```powershell
# 打开任务管理器 (Ctrl + Shift + Esc)
# 找到所有 node.exe 进程
# 右键 -> 结束任务
```

或使用命令:
```powershell
taskkill /F /IM node.exe
```

### 步骤 2: 验证进程已清理
```powershell
Get-Process node -ErrorAction SilentlyContinue
# 应该返回空结果
```

### 步骤 3: 启动开发服务器
```powershell
cd c:\Users\Administrator\Desktop\reddit-monitor
npm run dev
```

### 步骤 4: 验证性能
启动后检查:
```powershell
# 查看 Node 进程数量
Get-Process node | Measure-Object | Select-Object Count
# 应该只有 3-5 个进程

# 查看内存占用
Get-Process node | Select-Object Id, CPU, @{Name="MB";Expression={[math]::Round($_.WorkingSet64/1MB,2)}}
# 每个进程应该在 60-100 MB 范围
```

---

## 📊 预期效果

### 修复前
- Node 进程数: **100+**
- CPU 占用: **100%**
- 内存占用: **8-16 GB (98%)**
- 系统响应: **卡顿**

### 修复后
- Node 进程数: **3-5**
- CPU 占用: **5-15%**
- 内存占用: **200-500 MB (2-5%)**
- 系统响应: **流畅**

---

## ⚠️ 常见问题

### Q1: 仍然很卡怎么办？
1. 确认所有 Node 进程已清理
2. 重启电脑
3. 重新执行启动步骤

### Q2: 如何避免这个问题？
- **永远不要同时运行多个 `npm run dev`**
- 启动前先检查是否有残留进程
- 使用 `Ctrl+C` 正确停止服务器，而不是直接关闭终端

### Q3: 数据文件会越来越大吗？
是的。建议每周运行一次清理:
```powershell
node cleanup-data.js
```

### Q4: 可以进一步优化吗？
可以。后续可以:
1. 迁移到数据库 (SQLite/PostgreSQL)
2. 实现增量数据加载
3. 添加分页查询
4. 使用 Redis 缓存

---

## 🎯 快速命令参考

```powershell
# 停止所有 Node 进程
taskkill /F /IM node.exe

# 查看 Node 进程
Get-Process node

# 启动开发服务器
cd c:\Users\Administrator\Desktop\reddit-monitor; npm run dev

# 清理数据
node cleanup-data.js

# 压缩评论文件
node compress-comments.js

# 检查端口占用
netstat -ano | findstr :3000
```

---

## 📞 需要帮助？

如果问题仍然存在，请提供:
1. `Get-Process node` 的输出
2. `netstat -ano | findstr :3000` 的输出
3. data 目录下文件大小: `Get-ChildItem data -File`
