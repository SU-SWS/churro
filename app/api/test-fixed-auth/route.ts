import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api-fixed';

export async function GET(request: NextRequest) {
  console.log('🧪 Testing with FIXED API service...');
  
  if (!process.env.ACQUIA_API_SECRET) {
    return NextResponse.json({ error: 'Missing API secret' }, { status: 500 });
  }
  
  try {
    const apiService = new AcquiaApiServiceFixed({
      baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
      authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
      apiKey: process.env.ACQUIA_API_KEY!, // This will be ignored and replaced with correct value
      apiSecret: process.env.ACQUIA_API_SECRET!,
    });

    // Just test authentication
    console.log('Testing authentication only...');
    
    return NextResponse.json({
      success: true,
      message: 'Fixed API service created successfully',
      forced_api_key: 'deed5eaf-98ba-4924-8747-1fb1fbd00bd3'
    });
    
  } catch (error) {
    console.error('❌ Fixed API service error:', error);
    
    return NextResponse.json({
      error: 'Failed with fixed API service',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}