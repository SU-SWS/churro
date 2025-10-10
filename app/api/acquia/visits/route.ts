import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api';
import { getCachedData, setCachedData, generateApiCacheKey } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const resolution = searchParams.get('resolution');

  console.log('🔍 Visits API called with params:', { subscriptionUuid, from, to, resolution });

  if (!subscriptionUuid) {
    return NextResponse.json(
      { error: 'subscriptionUuid is required' },
      { status: 400 }
    );
  }

  // Generate cache key
  const cacheKey = generateApiCacheKey('visits', {
    subscriptionUuid,
    from: from || 'no-from',
    to: to || 'no-to',
    resolution: resolution || 'no-resolution'
  });

  console.log('🗝️ Visits cache key:', cacheKey);

  // Check cache first
  const cachedResult = await getCachedData(cacheKey);
  if (cachedResult) {
    console.log('📦 Returning cached visits data');
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

    console.log('🔧 Fetching fresh visits data from API...');
    const data = await apiService.getVisitsDataByApplication(
      subscriptionUuid,
      from || undefined,
      to || undefined,
      resolution || undefined
    );

    console.log('✅ Got fresh visits data:', data.length);

    const result = {
      data,
      totalItems: data.length,
      message: `Successfully fetched ${data.length} visit records across all pages`,
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
    console.error('❌ Visits API Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch visits by application data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
