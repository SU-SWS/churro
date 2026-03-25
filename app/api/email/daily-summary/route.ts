import { NextRequest, NextResponse } from 'next/server';
import { sendDailySummaryEmail } from '@/lib/email-service';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate Vercel cron job request
    const userAgent = request.headers.get('user-agent');
    const authHeader = request.headers.get('authorization');
    const cronSecretHeader = request.headers.get('x-cron-secret');

    // Check for Vercel cron user agent OR manual auth with CRON_SECRET
    const isVercelCron = userAgent?.includes('vercel-cron/1.0');

    // Validate CRON_SECRET is configured before doing any auth checks
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('❌ CRON_SECRET environment variable not configured');
      // Only allow Vercel cron if CRON_SECRET is not configured
      if (!isVercelCron) {
        return NextResponse.json({
          error: 'Service misconfigured - manual authentication not available'
        }, { status: 503 });
      }
    }

    const bearerAuth = cronSecret && authHeader?.startsWith('Bearer ') &&
                      authHeader.slice(7) === cronSecret;
    const headerAuth = cronSecret && cronSecretHeader === cronSecret;
    const manualAuth = bearerAuth || headerAuth;

    if (!isVercelCron && !manualAuth) {
      console.error('❌ Unauthorized cron call - not from Vercel cron and no valid CRON_SECRET');
      return NextResponse.json({
        error: 'Unauthorized - must be Vercel cron job or provide valid CRON_SECRET via Authorization or X-Cron-Secret header'
      }, { status: 401 });
    }

    const authMethod = isVercelCron ? 'Vercel Cron' :
                      bearerAuth ? 'Manual (Bearer token)' :
                      'Manual (X-Cron-Secret header)';
    console.log(`✅ ${authMethod} authentication successful - executing daily summary...`);

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