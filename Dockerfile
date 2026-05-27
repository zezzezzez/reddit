# 使用 Node.js 20 LTS 作为基础镜像
FROM node:20-alpine AS builder

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

# 复制启动脚本到构建输出目录
COPY start-with-proxy.js ./start-with-proxy.js

# 构建 Next.js 应用
RUN npm run build

# 生产镜像
FROM node:20-alpine AS runner

WORKDIR /app

# 只复制生产运行所需文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/data ./data
COPY --from=builder /app/start-with-proxy.js ./start-with-proxy.js

# 暴露端口
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用（使用代理初始化脚本）
CMD ["node", "start-with-proxy.js"]
