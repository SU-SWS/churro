import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api-fixed';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  console.log('🚀 Views by Application API Route called with params:', {
    subscriptionUuid,
    from,
    to
  });

  if (!subscriptionUuid) {
    console.error('❌ Missing required parameter: subscriptionUuid');
    return NextResponse.json(
      { error: 'subscriptionUuid is required' },
      { status: 400 }
    );
  }

  if (!process.env.ACQUIA_API_SECRET) {
    console.error('❌ Missing environment variable: ACQUIA_API_SECRET');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    const apiService = new AcquiaApiServiceFixed({
      baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
      authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
      apiKey: process.env.ACQUIA_API_KEY!, // This will be ignored and replaced
      apiSecret: process.env.ACQUIA_API_SECRET!,
    });

    // Set up progress logging
    apiService.setProgressCallback((progress) => {
      console.log('📈 Views progress:', progress);
    });

    console.log('🔧 Using FIXED API Service for views by application (with pagination)');

    const data = await apiService.getViewsDataByApplication(subscriptionUuid, from || undefined, to || undefined);
    
    console.log('✅ Successfully fetched ALL views by application data, total count:', data.length);
    
    return NextResponse.json({
      data,
      totalItems: data.length,
      message: `Successfully fetched ${data.length} view records across all pages`
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
        error: 'Failed to fetch views by application data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}