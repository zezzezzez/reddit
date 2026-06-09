// 测试直接访问 Reddit（不走代理）
const url = 'https://www.reddit.com/r/TVTooHigh/comments/1tnbz0g.json';
console.log('Testing direct Reddit access:', url);

try {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response length:', text.length);
  console.log('First 500 chars:', text.substring(0, 500));
} catch (e) {
  console.error('Error:', e.message);
}
