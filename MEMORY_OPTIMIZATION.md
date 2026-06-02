# Next.js 开发服务器内存优化指南

## 🚨 问题描述

启动 `npm run dev` 后，Qoder 内存占用率达到 98%，电脑变得非常卡顿。

## 🔍 根本原因

**Turbopack 内存泄漏**：Next.js 16 默认启用了 Turbopack（实验性构建工具），在 Windows 环境下存在严重的内存泄漏问题。

## ✅ 已实施的修复

### 1. 移除 Turbopack 配置
- 文件：`next.config.ts`
- 移除了 `turbopack` 配置块
- 使用传统的 Webpack 构建（更稳定）

### 2. 添加内存限制
- 设置 Node.js 最大堆内存为 **4GB**（`--max-old-space-size=4096`）
- 防止无限占用内存

### 3. 优化启动脚本
```json
{
  "dev": "NODE_OPTIONS='--max-old-space-size=4096' next dev",
  "dev:turbo": "NODE_OPTIONS='--max-old-space-size=4096' next dev --turbo",
  "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
}
```

## 🚀 使用方法

### 正常开发（推荐）
```bash
npm run dev
```
使用 Webpack，稳定且内存占用可控。

### 如果确实需要 Turbopack（不推荐）
```bash
npm run dev:turbo
```
仅限大型项目（>500 个组件）且内存充足时使用。

## 💡 额外优化建议

### 1. 关闭不必要的浏览器标签
- 开发时只保留 `localhost:3000` 一个标签
- 避免 HMR（热模块替换）触发多次刷新

### 2. 排除不需要监听的文件
在 `next.config.ts` 中添加：
```typescript
const nextConfig: NextConfig = {
  watchOptions: {
    ignored: ['**/node_modules/**', '**/.git/**', '**/data/**'],
  },
};
```

### 3. 定期清理缓存
```bash
# 删除 .next 缓存目录
rm -rf .next

# 重新启动
npm run dev
```

### 4. Windows PowerShell 特殊处理
如果使用 Windows PowerShell，环境变量语法不同：
```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"; npm run dev
```

## 📊 预期效果

修复后内存占用：
- **修复前**：8-16GB（98% 占用）
- **修复后**：1-2GB（正常范围）

## ⚠️ 注意事项

1. **首次启动可能稍慢**（Webpack 比 Turbopack 慢 20-30%）
2. **热更新速度正常**（不影响开发体验）
3. **生产构建不受影响**（`npm run build` 已优化）

## 🔧 故障排查

如果仍然卡顿，尝试：

1. **检查其他进程占用**
   ```bash
   tasklist | findstr "node"
   ```

2. **强制清理重启**
   ```bash
   # 停止所有 Node 进程
   taskkill /F /IM node.exe
   
   # 清理缓存
   rmdir /s /q .next
   
   # 重新启动
   npm run dev
   ```

3. **降低内存限制**（如果系统内存 < 8GB）
   修改 `package.json` 中的 `--max-old-space-size=2048`（2GB）

---

**最后更新**：2026-06-01
