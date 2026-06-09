const http = require('http');

const postData = JSON.stringify({ quickScan: true });

const options = {
  hostname: '3.76.37.129',
  port: 3000,
  path: '/api/scan',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('=== 测试 EC2 Decodo 代理抓取 Reddit ===');
console.log('触发快速扫描...\n');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Response Time:', Date.now());
    try {
      const json = JSON.parse(data);
      console.log('\n--- 扫描结果 ---');
      console.log('Success:', json.success);
      console.log('Message:', json.message);
      if (json.results) {
        console.log('Total results:', json.results.length);
        json.results.forEach((r, i) => {
          console.log(`\n  [${i+1}] Post: ${r.postId}`);
          console.log(`      Status: ${r.status}`);
          console.log(`      New comments: ${r.newComments || 0}`);
          console.log(`      Flagged: ${r.flagged || 0}`);
          if (r.error) console.log(`      Error: ${r.error}`);
        });
      }
      if (json.totalNewComments !== undefined) {
        console.log('\n--- 汇总 ---');
        console.log('New comments:', json.totalNewComments);
        console.log('Flagged:', json.totalFlagged);
      }
    } catch(e) {
      console.log('Raw response:', data.substring(0, 2000));
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.setTimeout(120000, () => {
  console.log('Request timed out (120s)');
  req.destroy();
});

req.write(postData);
req.end();
