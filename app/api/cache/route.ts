import { NextRequest, NextResponse } from 'next/server';

const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

export async function DELETE(request: NextRequest) {
  try {
    if (isLocal) {
      // Local development - clear file cache
      const { clearAllCache } = await import('@/lib/cache');
      await clearAllCache();
      return NextResponse.json({
        message: 'File cache cleared successfully',
        environment: 'local',
        timestamp: new Date().toISOString()
      });
    } else {
      // Vercel production - revalidate cache tags
      const { revalidateTag } = await import('next/cache');

      // Revalidate all the tags we use
      const tags = ['acquia-api', 'views', 'visits'];
      tags.forEach(tag => {
        revalidateTag(tag);
        console.log(`🗑️ Revalidated tag: ${tag}`);
      });

      return NextResponse.json({
        message: `Cache tags revalidated: ${tags.join(', ')}`,
        environment: 'production',
        timestamp: new Date().toISOString(),
        revalidatedTags: tags
      });
    }
  } catch (error) {
    console.error('Cache management error:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : 'Unknown error',
        environment: isLocal ? 'local' : 'production'
      },
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
    },
    availableTags: ['acquia-api', 'views', 'visits']
  });
}