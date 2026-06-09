import { ProxyAgent, fetch } from 'undici';

const proxyUrl = 'http://spo7492epm:8bLtd42alncz~TV0gK@gate.decodo.com:10001';
const agent = new ProxyAgent(proxyUrl);

console.log('=== Reddit 直连测试 ===\n');

// 测试1: 直接请求 Reddit JSON API（不通过代理）
console.log('[测试1] Reddit直接请求 (无代理):');
try {
  const res = await fetch('https://www.reddit.com/r/Hisense.json?limit=1&t=month', {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    }
  });
  console.log('  状态:', res.status);
  if (res.status === 200) {
    const data = await res.json();
    const posts = data.data?.children || [];
    console.log('  帖子数:', posts.length);
    if (posts.length > 0) {
      console.log('  最新帖子:', posts[0].data.title?.substring(0, 80));
    }
  }
} catch(e) {
  console.log('  失败:', e.message, e.cause?.code || '');
}

console.log('\n[测试2] Reddit通过代理:');
try {
  const res = await fetch('https://www.reddit.com/r/Hisense.json?limit=1&t=month', {
    dispatcher: agent,
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    }
  });
  console.log('  状态:', res.status);
  if (res.status === 200) {
    const data = await res.json();
    const posts = data.data?.children || [];
    console.log('  帖子数:', posts.length);
    if (posts.length > 0) {
      console.log('  最新帖子:', posts[0].data.title?.substring(0, 80));
    }
  }
} catch(e) {
  console.log('  失败:', e.message, e.cause?.code || '');
}

console.log('\n[测试3] 验证代理出口IP (httpbin):');
try {
  const res = await fetch('https://httpbin.org/ip', { dispatcher: agent, timeout: 10000 });
  const body = await res.json();
  console.log('  代理IP:', body.origin);
} catch(e) {
  console.log('  失败:', e.message, e.cause?.code || '');
}

console.log('\n=== 测试完成 ===');