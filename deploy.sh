#!/bin/bash
# AWS EC2 部署脚本
# 使用方法：bash deploy.sh

set -e

echo "🚀 开始部署 Reddit 监控系统到 AWS EC2..."

# 1. 更新系统
echo "📦 更新系统包..."
sudo yum update -y

# 2. 安装 Docker
echo "🐳 安装 Docker..."
sudo yum install -y docker
sudo service docker start
sudo usermod -aG docker ec2-user

# 3. 安装 Docker Compose
echo "🔧 安装 Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. 创建应用目录
echo "📁 创建应用目录..."
mkdir -p /home/ec2-user/reddit-monitor
cd /home/ec2-user/reddit-monitor

# 5. 克隆 GitHub 仓库
echo "📥 克隆 GitHub 仓库..."
git clone https://github.com/zezzezzez/reddit.git . || git pull origin main

# 6. 配置环境变量
echo "⚙️  配置环境变量..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 请编辑 .env 文件，填入飞书 Webhook URL"
    echo "   vim .env"
fi

# 7. 构建并启动容器
echo " 构建 Docker 镜像..."
sudo docker-compose build

echo "🚀 启动应用..."
sudo docker-compose up -d

# 8. 查看状态
echo ""
echo "✅ 部署完成！"
echo "📊 查看容器状态："
sudo docker-compose ps

echo ""
echo "🌐 访问地址："
echo "   http://$(curl -s ifconfig.me):3000"
echo ""
echo "📝 查看日志："
echo "   sudo docker-compose logs -f"
echo ""
echo "🔄 重启应用："
echo "   sudo docker-compose restart"
echo ""
echo "⏹️  停止应用："
echo "   sudo docker-compose down"
