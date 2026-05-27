// 测试扫描功能
const axios = require('axios');

async function testScan() {
  console.log('=== 测试扫描功能 ===\n');
  
  // 1. 检查当前帖子数据
  console.log('1. 获取帖子列表...');
  const postsRes = await axios.get('http://63.183.212.153:3000/api/posts');
  const posts = postsRes.data.posts;
  console.log(`   共 ${posts.length} 个帖子`);
  console.log(`   第一个帖子: ${posts[0]?.title?.substring(0, 50)}...`);
  console.log(`   totalCommentsFetched: ${posts[0]?.totalCommentsFetched}`);
  console.log(`   commentCount: ${posts[0]?.commentCount}`);
  console.log(`   lastScanned: ${posts[0]?.lastScanned}\n`);
  
  // 2. 执行扫描
  console.log('2. 执行扫描（快速扫描5个帖子）...');
  try {
    const scanRes = await axios.post('http://63.183.212.153:3000/api/scan', {
      quickScan: true
    });
    console.log('   扫描结果:');
    console.log(`   success: ${scanRes.data.success}`);
    console.log(`   message: ${scanRes.data.message}`);
    console.log(`   results 数量: ${scanRes.data.results?.length}`);
    
    if (scanRes.data.results && scanRes.data.results.length > 0) {
      console.log('\n   详细结果:');
      scanRes.data.results.slice(0, 3).forEach((r, i) => {
        console.log(`   [${i+1}] ${r.postId}: ${r.status} - ${r.newComments || 0} comments, ${r.flaggedCount || 0} flagged`);
      });
    }
  } catch (e) {
    console.error('   扫描失败:', e.response?.data || e.message);
  }
  
  // 3. 再次检查帖子数据
  console.log('\n3. 扫描后再次检查帖子数据...');
  const postsAfterRes = await axios.get('http://63.183.212.153:3000/api/posts');
  const postsAfter = postsAfterRes.data.posts;
  console.log(`   第一个帖子 totalCommentsFetched: ${postsAfter[0]?.totalCommentsFetched}`);
  console.log(`   第一个帖子 commentCount: ${postsAfter[0]?.commentCount}`);
  
  console.log('\n=== 测试完成 ===');
}

testScan().catch(console.error);
