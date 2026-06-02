// 直接测试 Reddit API 访问
const https = require('https');

const url = 'https://www.reddit.com/r/TVTooHigh/comments/1tnbz0g/85_of_huge_af_floor_tv_it_is_for_now.json';

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

console.log('测试直接访问 Reddit API（不使用代理）...');
console.log('URL:', url);

https.get(url, options, (res) => {
  console.log('状态码:', res.statusCode);
  console.log('响应头:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(data);
        console.log('\n✅ 成功获取数据！');
        if (Array.isArray(json) && json.length >= 2) {
          const postTitle = json[0]?.data?.children?.[0]?.data?.title;
          const commentCount = json[1]?.data?.children?.length || 0;
          console.log('帖子标题:', postTitle);
          console.log('评论数量:', commentCount);
        }
      } catch (e) {
        console.log('❌ JSON 解析失败:', e.message);
        console.log('原始数据前200字符:', data.substring(0, 200));
      }
    } else {
      console.log('❌ 请求失败');
      console.log('响应内容前200字符:', data.substring(0, 200));
    }
  });
}).on('error', (e) => {
  console.error('❌ 网络错误:', e.message);
});
