import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api';

export async function GET(request: NextRequest) {
  // console.log('🚀 Applications API Route called');

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
    const { searchParams } = new URL(request.url);
    const subscriptionUuid = searchParams.get('subscriptionUuid');

    console.log('🔍 Applications API called with subscriptionUuid:', subscriptionUuid);

    if (!subscriptionUuid) {
      return NextResponse.json({ error: 'subscriptionUuid is required' }, { status: 400 });
    }

    // Check environment variables
    if (!process.env.ACQUIA_API_KEY || !process.env.ACQUIA_API_SECRET) {
      console.error('❌ Missing API credentials');
      return NextResponse.json({ error: 'Missing API credentials' }, { status: 500 });
    }

    const service = new AcquiaApiServiceFixed({
      baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
      authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
      apiKey: process.env.ACQUIA_API_KEY,
      apiSecret: process.env.ACQUIA_API_SECRET,
    });

    console.log('🔧 Fetching applications...');
    const applications = await service.getApplications();
    console.log('✅ Got applications:', applications.length);

    const response = NextResponse.json(applications);
    response.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=3600');

    return response;
  } catch (error) {
    console.error('❌ Applications API Error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    if (error instanceof Error) {
      console.error('🔍 Error name:', error.name);
      console.error('🔍 Error message:', error.message);
      console.error('🔍 Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch applications',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}