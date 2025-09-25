import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const granularity = searchParams.get('granularity'); // Get granularity for daily data

  if (!subscriptionUuid) {
    console.error('❌ Missing required parameter: subscriptionUuid');
    return NextResponse.json(
      { error: 'subscriptionUuid is required' },
      { status: 400 }
    );
  }

  if (!process.env.ACQUIA_API_KEY || !process.env.ACQUIA_API_SECRET) {
    console.error('❌ Missing required environment variables!');
    return NextResponse.json(
      {
        error: 'Server configuration error: missing API credentials',
      },
      { status: 500 }
    );
  }

  try {
    const apiService = new AcquiaApiServiceFixed({
      baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
      authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
      apiKey: process.env.ACQUIA_API_KEY!,
      apiSecret: process.env.ACQUIA_API_SECRET!,
    });

    apiService.setProgressCallback((progress) => {
      // console.log('📈 Views progress:', progress);
    });

    const data = await apiService.getViewsDataByApplication(
      subscriptionUuid,
      from || undefined,
      to || undefined,
      granularity || undefined // Pass granularity to the service method
    );

    return NextResponse.json({
      data,
      totalItems: data.length,
      message: `Successfully fetched ${data.length} view records across all pages`,
    });
  } catch (error) {
    console.error('❌ API Route Error in /api/acquia/views:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch views by application data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
