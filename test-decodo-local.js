// 本地测试 Decodo 代理能否访问 Reddit
const { ProxyAgent, fetch } = require('undici');

const proxyUrl = 'http://spo7492epm:8bLtd42alncz~TV0gK@gate.decodo.com:10001';

async function test() {
  console.log('=== Decodo 代理 Reddit 连通性测试 ===\n');

  const agent = new ProxyAgent(proxyUrl);

  // Test 1: httpbin exit IP
  console.log('[1] 测试代理出口IP...');
  try {
    const res = await fetch('https://httpbin.org/ip', { dispatcher: agent, timeout: 15000 });
    const data = await res.json();
    console.log('  出口IP:', data.origin);
    console.log('  状态:', res.status, '\n');
  } catch (e) {
    console.log('  失败:', e.message, '\n');
  }

  // Test 2: Reddit via proxy
  console.log('[2] 通过代理访问 Reddit r/Hisense...');
  try {
    const res = await fetch('https://www.reddit.com/r/Hisense.json?limit=1', {
      dispatcher: agent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    console.log('  状态:', res.status, res.statusText);
    console.log('  Content-Type:', res.headers.get('content-type'));
    
    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text);
      const posts = data[0]?.data?.children || data?.data?.children || [];
      console.log('  帖子数:', posts.length);
      if (posts.length > 0) {
        console.log('  最新帖子:', posts[0].data.title?.substring(0, 80));
      }
    } else {
      console.log('  响应前200字符:', text.substring(0, 200));
    }
  } catch (e) {
    console.log('  失败:', e.message);
  }

  // Test 3: Reddit direct (no proxy)
  console.log('\n[3] 直连 Reddit (无代理)...');
  try {
    const res = await fetch('https://www.reddit.com/r/Hisense.json?limit=1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });
    console.log('  状态:', res.status, res.statusText);
  } catch (e) {
    console.log('  失败:', e.message);
  }

  console.log('\n=== 测试完成 ===');
}

test();
