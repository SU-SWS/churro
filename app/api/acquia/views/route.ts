import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api';
import { getCachedData, setCachedData, generateApiCacheKey } from '@/lib/cache';

export const revalidate = 21600; // 6 hours cache at route level

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const resolution = searchParams.get('resolution');

  console.log('🔍 Views API called with params:', { subscriptionUuid, from, to, resolution });

  if (!subscriptionUuid) {
    return NextResponse.json(
      { error: 'subscriptionUuid is required' },
      { status: 400 }
    );
  }

  // Generate cache key
  const cacheKey = generateApiCacheKey('views', {
    subscriptionUuid,
    from: from || 'no-from',
    to: to || 'no-to',
    resolution: resolution || 'no-resolution'
  });

  console.log('🗝️ Views cache key:', cacheKey);

  // Check cache first
  const cachedResult = await getCachedData(cacheKey);
  if (cachedResult) {
    console.log('📦 Returning cached views data');
    return NextResponse.json({
      ...cachedResult,
      cached: true,
      cacheKey
    });
  }

  try {
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

    const result = {
      data,
      totalItems: data.length,
      message: `Successfully fetched ${data.length} view records`,
      cached: false,
      timestamp: new Date().toISOString(),
      cacheKey
    };

    // Cache the result
    await setCachedData(cacheKey, result);

    const response = NextResponse.json(result);
    response.headers.set('Cache-Control', 'public, s-maxage=21600, max-age=21600, stale-while-revalidate=86400');

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
