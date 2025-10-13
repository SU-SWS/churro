import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ Cache invalidation requested');

    // Use simplified cache invalidation
    const { invalidateCache } = await import('@/lib/cache-hybrid');
    const result = await invalidateCache();

    return NextResponse.json({
      message: 'Cache invalidation triggered successfully',
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    console.error('❌ Cache management error:', error);
    return NextResponse.json(
      {
        error: 'Failed to invalidate cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Cache management API',
    environment: `${process.env.NODE_ENV || 'unknown'} (unstable_cache)`,
    cacheApproach: 'Single approach using unstable_cache everywhere',
    endpoints: {
      'DELETE /api/cache': 'Clear all cached data using cache-buster technique'
    }
  });
}