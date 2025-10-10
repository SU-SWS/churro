import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

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
      // Vercel production - use both revalidatePath and revalidateTag
      console.log('🗑️ Clearing Vercel cache...');

      // Clear all cached API routes
      const apiPaths = [
        '/api/acquia/views',
        '/api/acquia/visits',
        '/api/acquia/applications'
      ];

      apiPaths.forEach(path => {
        try {
          revalidatePath(path, 'page');
          console.log(`✅ Revalidated path: ${path}`);
        } catch (error) {
          console.error(`❌ Failed to revalidate path ${path}:`, error);
        }
      });

      // Also try revalidating tags
      const tags = ['acquia-api', 'views', 'visits'];
      tags.forEach(tag => {
        try {
          revalidateTag(tag);
          console.log(`✅ Revalidated tag: ${tag}`);
        } catch (error) {
          console.error(`❌ Failed to revalidate tag ${tag}:`, error);
        }
      });

      // Clear the entire data cache for the app
      try {
        revalidatePath('/', 'layout');
        console.log(`✅ Revalidated root layout`);
      } catch (error) {
        console.error(`❌ Failed to revalidate root:`, error);
      }

      return NextResponse.json({
        message: 'Cache cleared successfully',
        environment: 'production',
        timestamp: new Date().toISOString(),
        revalidatedPaths: apiPaths,
        revalidatedTags: tags,
        note: 'Used both revalidatePath and revalidateTag for maximum coverage'
      });
    }
  } catch (error) {
    console.error('❌ Cache management error:', error);
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
    availablePaths: ['/api/acquia/views', '/api/acquia/visits', '/api/acquia/applications'],
    availableTags: ['acquia-api', 'views', 'visits']
  });
}