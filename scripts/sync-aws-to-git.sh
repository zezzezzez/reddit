#!/bin/bash
# AWS 服务器上的数据同步脚本
# 用途：AWS 扫描完成后，将数据推送到 GitHub，供本地拉取

echo "================================"
echo "  AWS 数据同步到 GitHub"
echo "================================"
echo ""

cd ~/reddit

# 配置 Git 用户信息（如果是首次使用）
git config user.email "aws-reddit-monitor@example.com"
git config user.name "AWS Reddit Monitor"

# 检查数据文件是否有变更
echo "检查数据文件变更..."
git status --porcelain | grep "data/"

if [ $? -eq 0 ]; then
    echo ""
    echo "发现数据变更，开始同步..."
    echo ""
    
    # 添加数据文件
    git add data/posts.json data/comments.json data/scans.json data/config.json data/reports.json
    
    # 提交变更
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    git commit -m "AWS 扫描数据同步 - $TIMESTAMP"
    
    # 推送到 GitHub
    echo "推送到 GitHub..."
    git push origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "================================"
        echo "  同步成功！"
        echo "================================"
        echo ""
        echo "数据已推送到 GitHub"
        echo "本地可以运行 'git pull' 获取最新数据"
    else
        echo ""
        echo "错误：推送失败"
        exit 1
    fi
else
    echo ""
    echo "没有数据变更，无需同步"
fi
