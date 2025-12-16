import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api';
import { getCachedApiData, generateApiCacheKey } from '@/lib/cache-hybrid';
import { withApiAuthorization } from '@/lib/api-auth';
import { SamlUser } from '@/lib/session-auth';

export async function GET(request: NextRequest) {
  return withApiAuthorization(async (request: NextRequest, context: { user: SamlUser }) => {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const resolution = searchParams.get('resolution');
  // Note: t (timestamp) parameter is ignored - used only to force browser to make network request

  console.log('🔍 Visits API called with params:', { subscriptionUuid, from, to, resolution });

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
  const cacheKey = generateApiCacheKey('visits', {
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

        console.log('🔧 Fetching fresh visits data from API...');
        const data = await apiService.getVisitsDataByApplication(
          subscriptionUuid,
          from || undefined,
          to || undefined,
          resolution || undefined
        );

        console.log('✅ Got fresh visits data:', data.length);

        return {
          data,
          totalItems: data.length,
          message: `Successfully fetched ${data.length} visit records across all pages`,
          cached: false,
          timestamp: new Date().toISOString(),
          cacheKey,
          requestParams: { subscriptionUuid, from, to, resolution } // Add for debugging
        };
      },
      cacheKey,
      ['visits', subscriptionUuid] // Cache tags
    );

    // Return the result directly without cache status metadata
    // (hybrid caching is transparent - data is always fresh within 5-minute TTL)
    const response = NextResponse.json(result);

    // Disable browser caching completely - server handles all caching
    // no-store prevents any caching, no-cache forces revalidation
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('❌ Visits API Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch visits by application data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
  })(request);
}
