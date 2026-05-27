# 法兰克福 EC2 部署指南

## 第一步：在 AWS 控制台创建 EC2 实例

1. 打开 AWS EC2 控制台：https://console.aws.amazon.com/ec2
2. 确保区域选择为 **欧洲（法兰克福）eu-central-1**
3. 点击 "Launch instances"
4. 配置：
   - Name: `reddit-monitor-frankfurt`
   - AMI: Amazon Linux 2023
   - Instance type: t3.medium
   - Key pair: 创建新的密钥对（.pem 格式）
   - Security group: 允许 22 (SSH) 和 3000 (应用) 端口
   - Storage: 20GB
5. 点击 "Launch instance"

## 第二步：获取公网 IP

在 EC2 控制台查看实例详情，记录 Public IPv4 address。

## 第三步：SSH 连接

```bash
ssh -i your-key.pem ec2-user@你的公网IP
```

## 第四步：部署应用

连接成功后，执行以下命令：

```bash
# 1. 安装 Docker
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -aG docker ec2-user

# 2. 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. 克隆项目
git clone https://github.com/zezzezzez/reddit.git
cd reddit

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 填入飞书 Webhook URL
vim .env

# 5. 构建并启动
sudo docker-compose up -d --build

# 6. 查看状态
sudo docker-compose ps
sudo docker-compose logs -f
```

## 第五步：配置域名

在 hisense.com DNS 中添加：
```
类型: A
主机: reddit
值: 你的EC2公网IP
TTL: 300
```

## 第六步：配置 HTTPS（可选）

```bash
# 安装 Nginx
sudo yum install -y nginx
sudo systemctl start nginx

# 配置反向代理
# 编辑 /etc/nginx/nginx.conf
```

## 常用命令

```bash
# 查看日志
sudo docker-compose logs -f

# 重启应用
sudo docker-compose restart

# 更新代码
git pull origin main
sudo docker-compose up -d --build

# 停止应用
sudo docker-compose down
```
