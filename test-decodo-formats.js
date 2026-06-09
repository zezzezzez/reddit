const { ProxyAgent, fetch } = require('undici');

const baseUser = 'spo7492epm';
const pass = '8bLtd42alncz~TV0gK';
const gateway = 'gate.decodo.com:10001';

const formats = [
  { label: 'no-location (baseline)', user: baseUser },
  { label: 'country_us', user: `${baseUser}-country_us` },
  { label: 'cc_us', user: `${baseUser}-cc_us` },
  { label: 'loc_us', user: `${baseUser}-loc_us` },
  { label: 'region_us', user: `${baseUser}-region_us` },
  { label: 'country-us', user: `${baseUser}-country-us` },
];

async function testFormat(label, user) {
  const proxyUrl = `http://${user}:${pass}@${gateway}`;
  const agent = new ProxyAgent(proxyUrl);
  
  try {
    // First check exit IP
    const ipRes = await fetch('https://httpbin.org/ip', { dispatcher: agent, timeout: 10000 });
    const ipData = ipRes.ok ? await ipRes.json() : { origin: 'unknown' };
    
    // Then try Reddit
    const redditRes = await fetch('https://www.reddit.com/r/Hisense.json?limit=1', {
      dispatcher: agent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    
    let result = '';
    if (redditRes.ok) {
      const data = await redditRes.json();
      const posts = data[0]?.data?.children || data?.data?.children || [];
      result = `OK! ${posts.length} posts`;
      if (posts[0]) result += ` - "${posts[0].data.title?.substring(0, 50)}"`;
    } else {
      const text = await redditRes.text().catch(() => '');
      result = `HTTP ${redditRes.status} - ${text.substring(0, 100)}`;
    }
    
    console.log(`[${label}] IP=${ipData.origin} | Reddit: ${result}`);
  } catch (e) {
    console.log(`[${label}] ERROR: ${e.cause?.code || e.message}`);
  }
}

async function main() {
  console.log('=== Decodo Proxy Location Format Test ===\n');
  
  for (const f of formats) {
    await testFormat(f.label, f.user);
    await new Promise(r => setTimeout(r, 1000)); // rate limit
  }
  
  console.log('\n=== Done ===');
}

main();
