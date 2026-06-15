# 使用 Node.js 22 LTS 作为基础镜像（修复 undici ProxyAgent 兼容性问题）
FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装所有依赖（包括 devDependencies，构建时需要）
RUN npm ci

# 复制源代码
COPY . .

# 构建 Next.js 应用（使用 webpack 模式，兼容 Next.js 16 的 Turbopack 默认行为）
RUN npx next build --webpack

# 生产镜像
FROM node:22-alpine AS runner

WORKDIR /app

# 安装时区数据（确保 TZ 环境变量生效）
RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

# 只复制生产运行所需文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/data ./data

# 暴露端口
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用
CMD ["node", "server.js"]
