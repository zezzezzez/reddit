// 测试 Reddit API 是否能抓取帖子

async function testRedditAPI() {
  console.log('================================');
  console.log('  测试 Reddit API');
  console.log('================================\n');

  try {
    console.log('1. 测试获取 r/costco 最新帖子...');
    
    const response = await fetch('https://www.reddit.com/r/costco/new.json?limit=10', {
      headers: {
        'User-Agent': 'TestBot/1.0',
        'Accept': 'application/json'
      }
    });

    console.log(`   响应状态: ${response.status}`);

    if (!response.ok) {
      console.error(`   ❌ 请求失败: ${response.status}`);
      return;
    }

    const data = await response.json();
    
    if (!data || !data.data || !data.data.children) {
      console.error('   ❌ 数据格式错误');
      return;
    }

    const posts = data.data.children.filter(c => c.kind === 't3').map(c => c.data);
    
    console.log(`   ✅ 成功获取 ${posts.length} 条帖子\n`);

    console.log('2. 帖子列表:');
    posts.forEach((post, index) => {
      const date = new Date(post.created_utc * 1000);
      const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`   ${index + 1}. ${post.title.substring(0, 60)}${post.title.length > 60 ? '...' : ''}`);
      console.log(`      作者: u/${post.author} | 评论: ${post.num_comments} | ${daysAgo}天前`);
    });

    console.log('\n3. 过滤测试（最近3个月 + 评论>0）:');
    
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const filteredPosts = posts.filter(post => {
      const postDate = new Date(post.created_utc * 1000);
      return postDate >= threeMonthsAgo && post.num_comments > 0;
    });

    console.log(`   符合条件的帖子: ${filteredPosts.length} 条\n`);

    if (filteredPosts.length > 0) {
      console.log('4. 检查品牌关键词:');
      
      const brands = {
        'Hisense': ['hisense', '海信'],
        'TCL': ['tcl'],
        'Samsung': ['samsung', '三星'],
        'Sony': ['sony', '索尼']
      };

      Object.entries(brands).forEach(([brand, keywords]) => {
        const matchedPosts = filteredPosts.filter(post => {
          const content = `${post.title} ${post.selftext || ''}`.toLowerCase();
          return keywords.some(kw => content.includes(kw));
        });

        if (matchedPosts.length > 0) {
          console.log(`   ✓ ${brand}: ${matchedPosts.length} 条`);
        }
      });
    }

    console.log('\n================================');
    console.log('  测试完成！');
    console.log('================================');

  } catch (error) {
    console.error('\n❌ 测试失败:');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('fetch')) {
      console.error('\n   可能的原因:');
      console.error('   1. 网络连接问题');
      console.error('   2. 需要配置代理');
      console.error('   3. Reddit API 不可访问');
    }
  }
}

testRedditAPI();
