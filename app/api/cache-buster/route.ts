import { NextRequest, NextResponse } from 'next/server';
import { getGlobalCacheBuster } from '@/lib/cache-hybrid';

export async function GET(request: NextRequest) {
  const cacheBuster = getGlobalCacheBuster();

  console.log('🔍 Cache buster API called, returning:', cacheBuster);

  return NextResponse.json({
    cacheBuster,
    timestamp: new Date().toISOString()
  });
}