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
    // Update the API service initialization
    const apiService = new AcquiaApiServiceFixed({
      baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
      authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
      apiKey: process.env.ACQUIA_API_KEY!,
      apiSecret: process.env.ACQUIA_API_SECRET!,
    });

    // console.log('🔧 Using FIXED API Service for applications');

    const applications = await apiService.getApplications();
    
    // console.log('✅ Successfully fetched applications data, count:', applications.length);
    
    return NextResponse.json(applications);
  } catch (error) {
    console.error('❌ API Route Error:', error);
    
    if (error instanceof Error) {
      console.error('🔍 Error name:', error.name);
      console.error('🔍 Error message:', error.message);
      console.error('🔍 Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch applications data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}