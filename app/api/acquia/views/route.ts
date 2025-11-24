import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api';
import { getCachedApiData, generateApiCacheKey } from '@/lib/cache-hybrid';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const resolution = searchParams.get('resolution');
  // Note: t (timestamp) parameter is ignored - used only to force browser to make network request

  console.log('🔍 Views API called with params:', { subscriptionUuid, from, to, resolution });

  if (!subscriptionUuid) {
    return NextResponse.json(
      { error: 'subscriptionUuid is required' },
      { status: 400 }
    );
  }

  // Validate API credentials
  if (!process.env.ACQUIA_API_KEY || !process.env.ACQUIA_API_SECRET) {
    console.error('❌ Missing required environment variables!');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.startsWith('ACQUIA')));
    return NextResponse.json(
      {
        error: 'Server configuration error: missing API credentials',
        envCheck: {
          ACQUIA_API_KEY: process.env.ACQUIA_API_KEY ? `${process.env.ACQUIA_API_KEY.substring(0, 8)}...` : 'missing',
          ACQUIA_API_SECRET: process.env.ACQUIA_API_SECRET ? 'present' : 'missing',
          ACQUIA_API_BASE_URL: process.env.ACQUIA_API_BASE_URL || 'missing',
          ACQUIA_AUTH_BASE_URL: process.env.ACQUIA_AUTH_BASE_URL || 'missing'
        }
      },
      { status: 500 }
    );
  }

  // Generate cache key with ALL parameters
  const cacheKey = generateApiCacheKey('views', {
    subscriptionUuid,
    from,
    to,
    resolution
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

    // Disable browser caching completely - server handles all caching
    // no-store prevents any caching, no-cache forces revalidation
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

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
