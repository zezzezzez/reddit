const http = require('http');

const postData = JSON.stringify({
  postIds: ["1tnbz0g"],
  quickScan: false
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/scan',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('响应内容:');
    console.log(JSON.parse(data));
  });
});

req.on('error', (e) => {
  console.error(`请求错误: ${e.message}`);
});

req.write(postData);
req.end();
