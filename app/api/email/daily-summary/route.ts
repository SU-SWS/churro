import { NextRequest, NextResponse } from 'next/server';
import { sendDailySummaryEmail } from '@/lib/email-service';

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
      }, { status: 503 });
    }

    const authHeader = request.headers.get('authorization');
    const authorized = authHeader?.startsWith('Bearer ') && authHeader.slice(7) === cronSecret;

    if (!authorized) {
      console.error('❌ Unauthorized cron call - missing or invalid CRON_SECRET');
      return NextResponse.json({
        error: 'Unauthorized - provide CRON_SECRET via Authorization: Bearer header'
      }, { status: 401 });
    }

    console.log('✅ Authentication successful - executing daily summary...');

    // Call the shared email service function
    const result = await sendDailySummaryEmail();

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Error in daily summary cron job:', error);
    return NextResponse.json({
      success: false,
      message: 'Error executing daily summary cron job',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}