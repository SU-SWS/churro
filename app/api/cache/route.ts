import { NextRequest, NextResponse } from 'next/server';

// Fixed environment detection based on actual Vercel env vars
const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
const isVercel = !!process.env.VERCEL_ENV;

export async function DELETE(request: NextRequest) {
  try {
    console.log('🔍 Environment detection:', {
      isLocal,
      isVercel,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    });

    if (isLocal) {
      // Local development - directly clear file cache
      console.log('🏠 Clearing local file cache...');
      const { clearAllCache } = await import('@/lib/cache');
      await clearAllCache();

      return NextResponse.json({
        message: 'File cache cleared successfully',
        environment: 'local',
        method: 'file-clear',
        timestamp: new Date().toISOString()
      });
    } else {
      // Vercel - use cache-buster approach from cache-hybrid
      console.log('☁️ Invalidating Vercel cache using cache-buster...');
      const { invalidateCache } = await import('@/lib/cache-hybrid');
      const result = await invalidateCache();

      return NextResponse.json({
        message: 'Cache invalidation triggered successfully',
        timestamp: new Date().toISOString(),
        ...result
      });
    }
  } catch (error) {
    console.error('❌ Cache management error:', error);
    return NextResponse.json(
      {
        error: 'Failed to invalidate cache',
        details: error instanceof Error ? error.message : 'Unknown error',
        environment: isLocal ? 'local' : 'vercel',
        debug: {
          isLocal,
          isVercel,
          NODE_ENV: process.env.NODE_ENV,
          VERCEL_ENV: process.env.VERCEL_ENV
        }
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Cache management API',
    environment: isLocal ? 'Local (file cache)' : 'Vercel (cache-buster)',
    endpoints: {
      'DELETE /api/cache': 'Clear/invalidate all cached data'
    },
    debug: {
      isLocal,
      isVercel,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    }
  });
}