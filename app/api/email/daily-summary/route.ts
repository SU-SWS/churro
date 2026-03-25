import { NextRequest, NextResponse } from 'next/server';
import { sendDailySummaryEmail } from '@/lib/email-service';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store',
  'Pragma': 'no-cache',
};

export async function GET(request: NextRequest) {
  try {
    // Vercel automatically sends Authorization: Bearer <CRON_SECRET> with every cron invocation
    // when CRON_SECRET is set. Require it for all callers — cron and manual alike — so there
    // is no spoofable fallback path.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('❌ CRON_SECRET environment variable not configured');
      return NextResponse.json({
        error: 'Service misconfigured - CRON_SECRET is not set'
      }, { status: 503, headers: NO_CACHE_HEADERS });
    }

    const authHeader = request.headers.get('authorization');
    const parts = authHeader?.split(/\s+/) ?? [];
    const authorized = parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1] === cronSecret;

    if (!authorized) {
      console.error('❌ Unauthorized cron call - missing or invalid CRON_SECRET');
      return NextResponse.json({
        error: 'Unauthorized - provide CRON_SECRET via Authorization: Bearer header'
      }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    console.log('✅ Authentication successful - executing daily summary...');

    // Call the shared email service function
    const result = await sendDailySummaryEmail();

    if (result.success) {
      return NextResponse.json(result, { headers: NO_CACHE_HEADERS });
    } else {
      return NextResponse.json(result, { status: 500, headers: NO_CACHE_HEADERS });
    }
  } catch (error) {
    console.error('❌ Error in daily summary cron job:', error);
    return NextResponse.json({
      success: false,
      message: 'Error executing daily summary cron job',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}