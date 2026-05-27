// 重新生成 SSH 密钥并配置到 EC2
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EC2_IP = '63.183.212.153';
const EC2_USER = 'ec2-user';
const OLD_KEY_PATH = path.join(__dirname, '.ssh-key.pem');
const NEW_KEY_PATH = path.join(__dirname, 'reddit-monitor-new-key.pem');
const PUB_KEY_PATH = path.join(__dirname, 'reddit-monitor-new-key.pub');

console.log('=== 重新生成 SSH 密钥对并配置 ===\n');

// 步骤1：生成新的密钥对
console.log('步骤 1: 生成新的 SSH 密钥对');
try {
  // 删除旧密钥
  if (fs.existsSync(NEW_KEY_PATH)) {
    fs.unlinkSync(NEW_KEY_PATH);
  }
  if (fs.existsSync(PUB_KEY_PATH)) {
    fs.unlinkSync(PUB_KEY_PATH);
  }

  // 生成新密钥（4096位 RSA）
  const cmd = `ssh-keygen -t rsa -b 4096 -f "${NEW_KEY_PATH}" -N "" -C "reddit-monitor-ec2"`;
  console.log('执行:', cmd);
  execSync(cmd, { stdio: 'inherit' });
  
  console.log('✅ 密钥对生成成功');
  console.log('   私钥:', NEW_KEY_PATH);
  console.log('   公钥:', PUB_KEY_PATH, '\n');
} catch (e) {
  console.error(' 密钥生成失败:', e.message);
  process.exit(1);
}

// 步骤2：设置私钥权限
console.log('步骤 2: 设置私钥权限');
try {
  execSync(`icacls "${NEW_KEY_PATH}" /inheritance:r /grant:r "${process.env.UserName}:(R)"`, { stdio: 'inherit' });
  console.log('✅ 权限设置成功\n');
} catch (e) {
  console.error('️  权限设置失败（可忽略）:', e.message, '\n');
}

// 步骤3：读取公钥
console.log('步骤 3: 读取公钥');
const pubKey = fs.readFileSync(PUB_KEY_PATH, 'utf8').trim();
console.log('公钥内容:');
console.log(pubKey);
console.log('\n');

// 步骤4：指导用户通过 EC2 Instance Connect 配置
console.log('步骤 4: 将公钥添加到 EC2 服务器');
console.log('═══════════════════════════════════════════════════════════');
console.log('由于无法通过 SSH 连接，需要通过 AWS 控制台操作：');
console.log('');
console.log('方法 A: 通过 EC2 Instance Connect（推荐）');
console.log('───────────────────────────────────────────────────────────');
console.log('1. 登录 AWS 控制台: https://console.aws.amazon.com/ec2/');
console.log('2. 找到实例: i-0f56216cedd296bbf (63.183.212.153)');
console.log('3. 点击 "连接" → "EC2 Instance Connect"');
console.log('4. 点击 "连接" 按钮，打开浏览器终端');
console.log('5. 在终端中执行以下命令：');
console.log('');
console.log('   ┌─────────────────────────────────────────────────────┐');
console.log('   │  echo "' + pubKey + '" >> ~/.ssh/authorized_keys    │');
console.log('   └─────────────────────────────────────────────────────┘');
console.log('');
console.log('');

console.log('方法 B: 通过用户数据（User Data）');
console.log('───────────────────────────────────────────────────────────');
console.log('1. 停止实例（需要先停止才能修改）');
console.log('2. 操作 → 实例设置 → 编辑用户数据');
console.log('3. 添加以下内容:');
console.log('');
console.log('   #cloud-config');
console.log('   ssh_authorized_keys:');
console.log('     - ' + pubKey);
console.log('');
console.log('4. 启动实例');
console.log('═══════════════════════════════════════════════════════════\n');

// 步骤5：测试连接
console.log('步骤 5: 测试 SSH 连接');
console.log('配置完成后，执行以下命令测试:');
console.log('');
console.log('   ssh -i "' + NEW_KEY_PATH + '" -o StrictHostKeyChecking=no ' + EC2_USER + '@' + EC2_IP);
console.log('');

// 步骤6：部署命令
console.log('步骤 6: 连接成功后执行部署');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('cd ~/reddit');
console.log('git pull origin main');
console.log('');
console.log('sudo docker build -t reddit-monitor .');
console.log('');
console.log('sudo docker stop reddit-monitor || true');
console.log('sudo docker rm reddit-monitor || true');
console.log('');
console.log('sudo docker run -d \\');
console.log('  --name reddit-monitor \\');
console.log('  --restart unless-stopped \\');
console.log('  -p 3000:3000 \\');
console.log('  -e NODE_ENV=production \\');
console.log('  -v reddit-data:/app/data \\');
console.log('  reddit-monitor');
console.log('');
console.log('sudo docker ps');
console.log('═══════════════════════════════════════════════════════════\n');

// 步骤7：更新 GitHub Secret
console.log('步骤 7: 更新 GitHub Secret');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('1. 读取私钥内容:');
const privateKey = fs.readFileSync(NEW_KEY_PATH, 'utf8');
console.log('   私钥文件: ' + NEW_KEY_PATH);
console.log('');
console.log('2. 访问: https://github.com/zezzezzez/reddit/settings/secrets/actions');
console.log('3. 编辑 EC2_SSH_KEY，粘贴以下内容:');
console.log('');
console.log('   ┌─────────────────────────────────────────────────────┐');
console.log(privateKey);
console.log('   └─────────────────────────────────────────────────────');
console.log('');
console.log('4. 保存后，推送代码即可自动部署');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('✅ 密钥生成完成！');
console.log('\n下一步:');
console.log('1. 通过 EC2 Instance Connect 将公钥添加到服务器（步骤4）');
console.log('2. 测试 SSH 连接（步骤5）');
console.log('3. 执行部署命令（步骤6）');
console.log('4. 更新 GitHub Secret（步骤7）');
console.log('\n私钥文件已保存: ' + NEW_KEY_PATH);
console.log('请妥善保管，不要提交到 Git！');
