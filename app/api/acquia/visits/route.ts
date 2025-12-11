import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api';
import { withApiAuthorization } from '@/lib/api-auth';
import { SamlUser } from '@/lib/session-auth';

export async function GET(request: NextRequest) {
  return withApiAuthorization(async (request: NextRequest, context: { user: SamlUser }) => {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const resolution = searchParams.get('resolution'); // Get granularity for daily data

  /**
  console.log('🚀 Visits by Application API Route called with params:', {
    subscriptionUuid,
    from,
    to
  });
  */

  if (!subscriptionUuid) {
    console.error('❌ Missing required parameter: subscriptionUuid');
    return NextResponse.json(
      { error: 'subscriptionUuid is required' },
      { status: 400 }
    );
  }

  // Update the API service initialization with better error handling
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

  try {
    const apiService = new AcquiaApiServiceFixed({
      baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
      authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
      apiKey: process.env.ACQUIA_API_KEY,
      apiSecret: process.env.ACQUIA_API_SECRET,
    });

    apiService.setProgressCallback((progress) => {
      // console.log('📊 Visits progress:', progress);
    });
    // console.log('🔧 Using FIXED API Service for visits by application (with pagination)');

    const data = await apiService.getVisitsDataByApplication(
      subscriptionUuid,
      from || undefined,
      to || undefined,
      resolution || undefined
    );

    // console.log('✅ Successfully fetched ALL visits by application data, total count:', data.length);

    return NextResponse.json({
      data,
      totalItems: data.length,
      message: `Successfully fetched ${data.length} visit records across all pages`
    });
  } catch (error) {
    console.error('❌ API Route Error:', error);
    if (error instanceof Error) {
      console.error('🔍 Error name:', error.name);
      console.error('🔍 Error message:', error.message);
      console.error('🔍 Error stack:', error.stack);
    }

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
