import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api';
import { getCachedApiData, generateApiCacheKey } from '@/lib/cache-hybrid';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const resolution = searchParams.get('resolution');
  const cacheBuster = searchParams.get('_cb'); // ADD THIS LINE

  console.log('🔍 Views API called with params:', { subscriptionUuid, from, to, resolution, cacheBuster }); // Add cacheBuster to log

  if (!subscriptionUuid) {
    return NextResponse.json(
      { error: 'subscriptionUuid is required' },
      { status: 400 }
    );
  }

  // Generate cache key with ALL parameters INCLUDING cache buster
  const cacheKey = generateApiCacheKey('views', {
    subscriptionUuid,
    from,
    to,
    resolution,
    _cb: cacheBuster // ADD THIS LINE
  });

  try {
    // Use hybrid caching
    const result = await getCachedApiData(
      async () => {
        // This function only runs on cache miss
        const apiService = new AcquiaApiServiceFixed({
          baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
          authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
          apiKey: process.env.ACQUIA_API_KEY!,
          apiSecret: process.env.ACQUIA_API_SECRET!,
        });

        console.log('🔧 Fetching fresh views data from API...');
        const data = await apiService.getViewsDataByApplication(
          subscriptionUuid,
          from || undefined,
          to || undefined,
          resolution || undefined
        );

        console.log('✅ Got fresh views data:', data.length);

        return {
          data,
          totalItems: data.length,
          message: `Successfully fetched ${data.length} view records`,
          cached: false,
          timestamp: new Date().toISOString(),
          cacheKey,
          requestParams: { subscriptionUuid, from, to, resolution } // Add for debugging
        };
      },
      cacheKey,
      ['views', subscriptionUuid] // Cache tags
    );

    // Add cache status to response
    const response = NextResponse.json({
      ...result,
      cached: true
    });

    return response;
  } catch (error) {
    console.error('❌ Views API Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch views data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
