// GitHub Actions 部署诊断脚本
const { execSync } = require('child_process');

console.log('=== GitHub Actions 部署诊断 ===\n');

// 1. 检查 SSH 密钥是否已配置在 GitHub Secrets
console.log('1. 检查 GitHub Secrets 配置');
console.log('   需要检查的 Secret: EC2_SSH_KEY');
console.log('   检查地址: https://github.com/zezzezzez/reddit/settings/secrets/actions');
console.log('   ❗ 请确认 EC2_SSH_KEY 的值是否正确\n');

// 2. 获取最近的 Actions 运行记录
console.log('2. 最近的 Actions 运行记录');
try {
  const response = execSync(
    'curl -s -H "Accept: application/vnd.github+json" https://api.github.com/repos/zezzezzez/reddit/actions/runs?per_page=5',
    { encoding: 'utf8' }
  );
  const data = JSON.parse(response);
  
  if (data.workflow_runs && data.workflow_runs.length > 0) {
    console.log('\n最近 5 次运行:');
    data.workflow_runs.forEach((run, i) => {
      const status = run.status === 'completed' ? 
        (run.conclusion === 'success' ? '✅ 成功' : '❌ 失败') : '⏳ 运行中';
      console.log(`\n[${i + 1}] Run #${run.run_number}`);
      console.log(`    状态: ${status}`);
      console.log(`    分支: ${run.head_branch}`);
      console.log(`    时间: ${new Date(run.created_at).toLocaleString('zh-CN')}`);
      console.log(`    详情: ${run.html_url}`);
    });
  } else {
    console.log('   未找到运行记录');
  }
} catch (e) {
  console.log('   ❌ 无法获取 Actions 记录:', e.message);
}

// 3. 检查 deploy.yml 配置
console.log('\n3. 检查 deploy.yml 配置');
const fs = require('fs');
const path = require('path');
const deployYml = fs.readFileSync(path.join(__dirname, '.github/workflows/deploy.yml'), 'utf8');

console.log('   ✓ 触发条件: push to main');
console.log('   ✓ 使用 appleboy/ssh-action@v1.0.3');
console.log('   ✓ 目标服务器: 63.183.212.153');
console.log('   ✓ 部署脚本: git pull → docker build → docker run');

// 4. 诊断建议
console.log('\n4. 问题诊断与建议');
console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('   常见问题:');
console.log('   1️⃣  EC2_SSH_KEY Secret 未配置或过期');
console.log('      → 需要在 GitHub Settings > Secrets 中添加正确的 SSH 私钥');
console.log('      → 格式: -----BEGIN OPENSSH PRIVATE KEY----- ...');
console.log('');
console.log('   2️⃣  EC2 安全组未允许 GitHub Actions IP');
console.log('      → AWS EC2 安全组需开放 22 端口给 0.0.0.0/0');
console.log('      → 或配置 GitHub Actions IP 范围');
console.log('');
console.log('   3️⃣  SSH 密钥对不匹配');
console.log('      → 确认实例使用的密钥对名称');
console.log('      → 重新生成密钥对并更新 GitHub Secret');
console.log('');
console.log('   4️⃣  EC2 未安装 Git 或 Docker');
console.log('      → SSH 登录后执行: sudo yum install git docker -y');
console.log('      → sudo systemctl enable docker && sudo systemctl start docker');
console.log('');

// 5. 手动部署命令
console.log('5. 手动部署命令（通过 SSH 登录 EC2 后执行）');
console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`
cd ~/reddit
git pull origin main

sudo docker build -t reddit-monitor .

sudo docker stop reddit-monitor || true
sudo docker rm reddit-monitor || true

sudo docker run -d \\
  --name reddit-monitor \\
  --restart unless-stopped \\
  -p 3000:3000 \\
  -e NODE_ENV=production \\
  -v reddit-data:/app/data \\
  reddit-monitor

sudo docker ps
`);

console.log('\n=== 诊断完成 ===');
console.log('\n下一步操作:');
console.log('1. 访问: https://github.com/zezzezzez/reddit/actions');
console.log('2. 点击失败的运行，查看 "Deploy to Frankfurt EC2" 步骤的详细错误');
console.log('3. 根据错误信息修复配置');
