import { NextRequest, NextResponse } from 'next/server';
import { testAcquiaAuth } from '@/lib/test-auth';

export async function GET(request: NextRequest) {
  console.log('🧪 Test authentication endpoint called');
  
  if (!process.env.ACQUIA_API_KEY || !process.env.ACQUIA_API_SECRET) {
    return NextResponse.json(
      { error: 'Missing API credentials in environment variables' },
      { status: 500 }
    );
  }
  
  const result = await testAcquiaAuth(
    process.env.ACQUIA_API_KEY,
    process.env.ACQUIA_API_SECRET
  );
  
  return NextResponse.json(result);
}