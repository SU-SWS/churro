import { NextRequest, NextResponse } from 'next/server';

const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

export async function DELETE(request: NextRequest) {
  try {
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
      // Production - use cache-buster approach
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
        environment: isLocal ? 'local' : 'production'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Cache management API',
    environment: isLocal ? 'Local (file cache)' : 'Production (cache-buster)',
    endpoints: {
      'DELETE /api/cache': 'Invalidate all cached data'
    },
    note: isLocal ?
      'Local development uses file-based cache clearing' :
      'Production uses cache-buster timestamps to force new cache keys'
  });
}