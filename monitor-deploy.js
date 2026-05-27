// 监控 GitHub Actions 部署状态
const { execSync } = require('child_process');

console.log('=== 监控 GitHub Actions 部署状态 ===\n');

let attempts = 0;
const maxAttempts = 30; // 最多等待 5 分钟（每 10 秒检查一次）

function checkStatus() {
  attempts++;
  
  try {
    const response = execSync(
      'curl -s -H "Accept: application/vnd.github+json" https://api.github.com/repos/zezzezzez/reddit/actions/runs?per_page=1',
      { encoding: 'utf8' }
    );
    const data = JSON.parse(response);
    const run = data.workflow_runs[0];
    
    console.log(`[检查 #${attempts}] Run #${run.run_number}`);
    console.log(`  状态: ${run.status}`);
    console.log(`  结论: ${run.conclusion || '等待中...'}`);
    console.log(`  时间: ${new Date(run.updated_at).toLocaleString('zh-CN')}`);
    console.log(`  详情: ${run.html_url}\n`);
    
    if (run.status === 'completed') {
      if (run.conclusion === 'success') {
        console.log('✅ 部署成功！');
        console.log('\n访问地址: http://63.183.212.153:3000');
        console.log('请检查是否显示最新代码\n');
      } else {
        console.log('❌ 部署失败！');
        console.log(`\n请查看详细日志: ${run.html_url}`);
        console.log('点击 "Deploy to Frankfurt EC2" 步骤查看错误信息\n');
      }
      return;
    }
    
    if (attempts >= maxAttempts) {
      console.log('⏰ 等待超时，请手动检查:');
      console.log(run.html_url);
      return;
    }
    
    // 10 秒后再次检查
    setTimeout(checkStatus, 10000);
    
  } catch (e) {
    console.error('检查失败:', e.message);
    if (attempts < maxAttempts) {
      setTimeout(checkStatus, 10000);
    }
  }
}

checkStatus();
