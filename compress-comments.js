// 压缩 comments.json - 移除不必要的大字段
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const commentsFile = path.join(DATA_DIR, 'comments.json');

console.log('🗜️  开始压缩 comments.json...\n');

const comments = JSON.parse(fs.readFileSync(commentsFile, 'utf-8'));
console.log(`📝 压缩前评论数: ${comments.length}`);
console.log(`📦 压缩前文件大小: ${(fs.statSync(commentsFile).size / 1024).toFixed(2)} KB\n`);

// 移除不必要的大字段，保留核心字段
const compressedComments = comments.map(c => ({
  id: c.id,
  postId: c.postId,
  author: c.author,
  body: c.body,
  score: c.score,
  createdAt: c.createdAt,
  sentiment: c.sentiment,
  permalink: c.permalink,
  // 移除或截断过长的字段
  bodyHtml: undefined, // 删除HTML版本
  replies: undefined, // 删除嵌套回复（如果需要，可从API重新获取）
}));

fs.writeFileSync(commentsFile, JSON.stringify(compressedComments, null, 2), 'utf-8');

const newSize = fs.statSync(commentsFile).size;
console.log(`📦 压缩后文件大小: ${(newSize / 1024).toFixed(2)} KB`);
console.log(`✅ 节省了 ${((1 - newSize / fs.statSync(commentsFile).size) * 100).toFixed(1)}% 空间\n`);

console.log('✅ 压缩完成！重启服务器即可看到性能提升。');
