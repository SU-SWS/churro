import { NextRequest, NextResponse } from 'next/server';
import { invalidateCache } from '@/lib/cache-hybrid';

export async function DELETE(request: NextRequest) {
  try {
    await invalidateCache(['acquia-api', 'views', 'visits']);
    return NextResponse.json({
      message: 'Cache invalidated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

  return NextResponse.json({
    message: 'Cache management API',
    environment: isLocal ? 'Local (file cache)' : 'Production (unstable_cache)',
    endpoints: {
      'DELETE /api/cache': 'Clear/invalidate all cached data'
    }
  });
}