#!/usr/bin/env node

// 测试免费代理是否能访问 Reddit
// 用法: node test-free-proxies.js

const proxies = [
  // 来自 https://free-proxy-list.net/ 和 https://www.proxyscrape.com/
  'http://103.155.217.1:41453',
  'http://103.155.217.105:4145',
  'http://103.155.217.156:4145',
  'http://103.155.217.200:4145',
  'http://103.155.217.25:4145',
  'http://103.155.217.52:4145',
  'http://103.155.217.88:4145',
  'http://45.77.55.173:8080',
  'http://139.99.237.62:80',
  'http://51.79.157.81:443',
  'http://162.223.90.130:80',
  'http://195.154.181.230:80',
  'http://51.159.115.233:3128',
  'http://91.107.233.194:8080',
  'http://185.199.196.252:8080',
  'http://46.101.49.62:80',
  'http://159.89.195.14:8080',
];

async function testProxy(proxyUrl) {
  try {
    const { ProxyAgent, setGlobalDispatcher, Agent } = await import('undici');
    
    // 设置代理
    const proxyAgent = new ProxyAgent(proxyUrl);
    setGlobalDispatcher(proxyAgent);
    
    // 测试访问 Reddit
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch('https://www.reddit.com/.json?limit=1', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HisenseRedditMonitor/1.0',
      },
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        proxy: proxyUrl,
        status: response.status,
        message: `成功! 获取到 ${(data[0]?.data?.children?.length || 0)} 个帖子`,
      };
    } else {
      return {
        success: false,
        proxy: proxyUrl,
        status: response.status,
        message: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      proxy: proxyUrl,
      status: null,
      message: error.name === 'AbortError' ? '超时' : error.message,
    };
  } finally {
    // 重置 dispatcher
    const { Agent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new Agent());
  }
}

async function main() {
  console.log('=== 测试免费代理访问 Reddit ===\n');
  console.log(`共 ${proxies.length} 个代理需要测试\n`);
  
  const results = [];
  let successCount = 0;
  
  for (let i = 0; i < proxies.length; i++) {
    const proxy = proxies[i];
    console.log(`[${i + 1}/${proxies.length}] 测试: ${proxy}`);
    
    const result = await testProxy(proxy);
    results.push(result);
    
    if (result.success) {
      successCount++;
      console.log(`  ✅ 成功! ${result.message}\n`);
    } else {
      console.log(`  ❌ 失败: ${result.message}\n`);
    }
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n=== 测试结果汇总 ===\n');
  console.log(`总计: ${proxies.length} 个代理`);
  console.log(`成功: ${successCount} 个`);
  console.log(`失败: ${proxies.length - successCount} 个\n`);
  
  if (successCount > 0) {
    console.log('✅ 可用的代理:');
    results.filter(r => r.success).forEach(r => {
      console.log(`  - ${r.proxy}`);
    });
    console.log('\n请选择一个代理配置到 EC2 服务器');
  } else {
    console.log('❌ 没有找到可用的免费代理');
    console.log('建议: 考虑使用付费代理或更换云服务器提供商');
  }
}

main().catch(console.error);
