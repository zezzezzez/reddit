import { ProxyAgent, fetch } from 'undici';
import { URL } from 'node:url';

const proxyUrl = 'http://spo7492epm:8bLtd42alncz~TV0gK@gate.decodo.com:10001';
const agent = new ProxyAgent(proxyUrl);

async function testUrl(label, url, opts = {}) {
  console.log(`${label}...`);
  try {
    const res = await fetch(url, { dispatcher: agent, timeout: 20000, ...opts });
    console.log(`  OK - ${res.status}`);
    if (res.status === 200) {
      try {
        const body = await res.json();
        if (body[0]?.data?.children?.[0]?.data?.title) {
          console.log(`  Title: ${body[0].data.children[0].data.title.substring(0, 60)}`);
        } else if (body?.data?.children?.[0]?.data?.title) {
          console.log(`  Title: ${body.data.children[0].data.title.substring(0, 60)}`);
        } else {
          console.log(`  JSON size: ${JSON.stringify(body).length}`);
        }
      } catch {}
    }
  } catch(e) {
    console.error(`  FAIL: ${e.message} (${e.cause?.code || ''})`);
  }
}

async function main() {
  // Reddit JSON API
  await testUrl('Reddit /r/popular.json', 'https://www.reddit.com/r/popular.json?limit=1');
  await testUrl('Reddit /r/technology.json', 'https://www.reddit.com/r/technology.json?limit=1');
  await testUrl('Reddit specific post (direct URL)', 'https://www.reddit.com/r/TVTooHigh/comments/1tnbz0g/85_of_huge_af_floor_tv_it_is_for_now.json');
  
  // Also test with different user-agent
  await testUrl('Reddit with Safari UA', 'https://www.reddit.com/r/technology.json?limit=1', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15' }
  });
  
  // Try without proxy for comparison
  console.log('\nWithout proxy (direct):');
  try {
    const res = await fetch('https://www.reddit.com/r/technology.json?limit=1', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15' },
      timeout: 15000
    });
    console.log(`  OK - ${res.status}`);
    res.body?.cancel();
  } catch(e) {
    console.error(`  FAIL: ${e.message} (${e.cause?.code || ''})`);
  }
}

main();
