import { NextResponse } from 'next/server';
import { isApifyConfigured } from '@/lib/apify';

export async function GET() {
  const results: any = {
    envCheck: {},
    apifyStatus: null,
  };

  // 1. Check environment variables
  results.envCheck = {
    APIFY_TOKEN: process.env.APIFY_TOKEN ? 'SET (' + process.env.APIFY_TOKEN.substring(0, 15) + '...)' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  };

  // 2. Check Apify configuration
  results.apifyStatus = {
    configured: isApifyConfigured(),
    message: isApifyConfigured() ? 'Apify 已配置，可以抓取 Reddit 数据' : 'Apify 未配置，请设置 APIFY_TOKEN',
  };

  return NextResponse.json(results);
}
