// 测试通过代理访问 Reddit
const { ProxyAgent, fetch } = require('undici');

const url = 'https://www.reddit.com/r/TVTooHigh/comments/1tnbz0g/85_of_huge_af_floor_tv_it_is_for_now.json';

// 使用海信代理
const proxyUrl = 'http://10.19.193.99:443';

async function testWithProxy() {
  console.log('测试通过代理访问 Reddit API...');
  console.log('代理:', proxyUrl);
  console.log('URL:', url);
  
  try {
    const agent = new ProxyAgent(proxyUrl);
    
    const response = await fetch(url, {
      dispatcher: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });
    
    console.log('\n状态码:', response.status);
    console.log('状态文本:', response.statusText);
    
    const text = await response.text();
    
    if (response.status === 200) {
      try {
        const json = JSON.parse(text);
        console.log('\n✅ 成功获取数据！');
        if (Array.isArray(json) && json.length >= 2) {
          const postTitle = json[0]?.data?.children?.[0]?.data?.title;
          const commentCount = json[1]?.data?.children?.length || 0;
          console.log('帖子标题:', postTitle);
          console.log('评论数量:', commentCount);
        } else {
          console.log('❌ 数据结构异常');
          console.log('数据前200字符:', text.substring(0, 200));
        }
      } catch (e) {
        console.log('❌ JSON 解析失败:', e.message);
        console.log('原始数据前300字符:', text.substring(0, 300));
      }
    } else {
      console.log('❌ 请求失败');
      console.log('响应内容前300字符:', text.substring(0, 300));
    }
  } catch (e) {
    console.error('❌ 错误:', e.message);
    console.error('完整错误:', e);
  }
}

testWithProxy();
