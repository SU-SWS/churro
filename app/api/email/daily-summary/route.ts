import { NextRequest, NextResponse } from 'next/server';
import { sendDailySummaryEmail } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate Vercel cron job request
    const userAgent = request.headers.get('user-agent');
    const authHeader = request.headers.get('authorization');

    // Check for Vercel cron user agent OR manual auth with CRON_SECRET
    const isVercelCron = userAgent?.includes('vercel-cron/1.0');
    const manualAuth = authHeader?.startsWith('Bearer ') &&
                      authHeader.slice(7) === process.env.CRON_SECRET;

    if (!isVercelCron && !manualAuth) {
      console.error('❌ Unauthorized cron call - not from Vercel cron and no valid CRON_SECRET');
      return NextResponse.json({
        error: 'Unauthorized - must be Vercel cron job or provide valid CRON_SECRET'
      }, { status: 401 });
    }

    const requestSource = isVercelCron ? 'Vercel Cron' : 'Manual (authenticated)';
    console.log(`✅ ${requestSource} authentication successful - executing daily summary...`);

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