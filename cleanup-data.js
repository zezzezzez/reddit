// 数据清理脚本 - 解决性能问题
// 运行方式: node cleanup-data.js

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// 读取JSON文件
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

// 写入JSON文件
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

console.log('🔍 开始清理数据...\n');

// 1. 清理 comments.json - 只保留最近 5000 条评论
const commentsFile = path.join(DATA_DIR, 'comments.json');
const comments = readJson(commentsFile) || [];
console.log(`📝 清理前评论数: ${comments.length}`);

if (comments.length > 5000) {
  const recentComments = comments.slice(-5000);
  writeJson(commentsFile, recentComments);
  console.log(`✅ 评论已清理: 保留最近 5000 条 (删除了 ${comments.length - 5000} 条)\n`);
} else {
  console.log(`✅ 评论数量正常，无需清理\n`);
}

// 2. 清理 scans.json - 只保留最近 100 次扫描
const scansFile = path.join(DATA_DIR, 'scans.json');
const scans = readJson(scansFile) || [];
console.log(`📊 清理前扫描数: ${scans.length}`);

if (scans.length > 100) {
  const recentScans = scans.slice(-100);
  writeJson(scansFile, recentScans);
  console.log(`✅ 扫描记录已清理: 保留最近 100 次 (删除了 ${scans.length - 100} 次)\n`);
} else {
  console.log(`✅ 扫描记录数量正常，无需清理\n`);
}

// 3. 清理 posts.json - 只保留最近 500 个帖子
const postsFile = path.join(DATA_DIR, 'posts.json');
const posts = readJson(postsFile) || [];
console.log(`📌 清理前帖子数: ${posts.length}`);

if (posts.length > 500) {
  const recentPosts = posts.slice(-500);
  writeJson(postsFile, recentPosts);
  console.log(`✅ 帖子已清理: 保留最近 500 个 (删除了 ${posts.length - 500} 个)\n`);
} else {
  console.log(`✅ 帖子数量正常，无需清理\n`);
}

// 4. 清理 competitor-history.json - 只保留最近 200 条
const competitorFile = path.join(DATA_DIR, 'competitor-history.json');
const competitorHistory = readJson(competitorFile) || [];
console.log(`🏢 清理前竞品记录数: ${competitorHistory.length}`);

if (competitorHistory.length > 200) {
  const recentHistory = competitorHistory.slice(-200);
  writeJson(competitorFile, recentHistory);
  console.log(`✅ 竞品记录已清理: 保留最近 200 条 (删除了 ${competitorHistory.length - 200} 条)\n`);
} else {
  console.log(`✅ 竞品记录数量正常，无需清理\n`);
}

// 显示清理后的文件大小
console.log('📦 清理后的文件大小:');
const files = ['posts.json', 'comments.json', 'scans.json', 'competitor-history.json', 'keyword-history.json', 'reports.json', 'config.json'];
files.forEach(file => {
  const filePath = path.join(DATA_DIR, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`  ${file}: ${sizeKB} KB`);
  }
});

console.log('\n✅ 数据清理完成！');
console.log('\n💡 建议:');
console.log('  1. 重启开发服务器: npm run dev');
console.log('  2. 如果仍有性能问题，检查是否有多个 Node 进程在运行');
console.log('  3. 使用任务管理器结束所有 node.exe 进程后重新启动');
