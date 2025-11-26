import { NextRequest, NextResponse } from 'next/server';
import { sendDailySummaryEmail } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  const cronSecretHeader = request.headers.get('x-cron-secret');

  // Accept cron secret from either Authorization header or X-Cron-Secret header
  const providedSecret = authHeader?.replace('Bearer ', '') || cronSecretHeader;

  if (providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Call the shared email service function
  const result = await sendDailySummaryEmail();

  if (result.success) {
    return NextResponse.json(result);
  } else {
    return NextResponse.json(result, { status: 500 });
  }
}