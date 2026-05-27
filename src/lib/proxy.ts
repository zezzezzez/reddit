// Proxy configuration for HTTP requests
// Uses undici's ProxyAgent to route fetch requests through proxy

import { ProxyAgent, setGlobalDispatcher } from 'undici';

const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;

let proxyConfigured = false;

export function configureProxy() {
  if (proxyConfigured || !PROXY_URL) {
    return;
  }

  try {
    console.log(`[Proxy] Configuring proxy: ${PROXY_URL}`);
    
    // Create proxy agent
    const proxyAgent = new ProxyAgent(PROXY_URL);
    
    // Set as global dispatcher for all fetch requests
    setGlobalDispatcher(proxyAgent);
    
    proxyConfigured = true;
    console.log('[Proxy] Proxy configured successfully');
  } catch (error) {
    console.error('[Proxy] Failed to configure proxy:', error);
  }
}

export function isProxyConfigured() {
  return proxyConfigured && !!PROXY_URL;
}

export function getProxyUrl() {
  return PROXY_URL || null;
}
