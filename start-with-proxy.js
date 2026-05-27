#!/usr/bin/env node

// Startup script that initializes proxy before starting Next.js server
// This ensures all fetch requests go through proxy from the beginning

const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;

if (PROXY_URL) {
  console.log('[Startup] Configuring proxy:', PROXY_URL);
  
  try {
    const undici = require('undici');
    const proxyAgent = new undici.ProxyAgent(PROXY_URL);
    undici.setGlobalDispatcher(proxyAgent);
    console.log('[Startup] Proxy configured successfully');
  } catch (error) {
    console.error('[Startup] Failed to configure proxy:', error.message);
    process.env.HTTP_PROXY = PROXY_URL;
    process.env.HTTPS_PROXY = PROXY_URL;
  }
} else {
  console.log('[Startup] No proxy configured (HTTP_PROXY not set)');
}

// Then start the Next.js server
console.log('[Startup] Starting Next.js server...');
require('./server');
