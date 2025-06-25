import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    node_env: process.env.NODE_ENV,
    has_api_key: !!process.env.ACQUIA_API_KEY,
    has_api_secret: !!process.env.ACQUIA_API_SECRET,
    api_key_length: process.env.ACQUIA_API_KEY?.length || 0,
    api_secret_length: process.env.ACQUIA_API_SECRET?.length || 0,
    api_key_preview: process.env.ACQUIA_API_KEY?.substring(0, 8) + '...' || 'undefined',
    all_env_keys: Object.keys(process.env).filter(key => key.startsWith('ACQUIA_')),
  });
}