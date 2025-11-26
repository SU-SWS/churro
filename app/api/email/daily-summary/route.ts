import { NextRequest, NextResponse } from 'next/server';
import { sendDailySummaryEmail } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  // Verify cron authentication using Vercel's native mechanism
  const authHeader = request.headers.get('authorization');

  // Vercel cron jobs inject: Authorization: Bearer <CRON_SECRET>
  // Extract the token from "Bearer <token>" format
  const cronToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // Verify against environment variable
  if (!cronToken || cronToken !== process.env.CRON_SECRET) {
    console.error('❌ Unauthorized cron call - invalid or missing CRON_SECRET');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('✅ Cron authentication successful - executing daily summary...');

  // Call the shared email service function
  const result = await sendDailySummaryEmail();

  if (result.success) {
    return NextResponse.json(result);
  } else {
    return NextResponse.json(result, { status: 500 });
  }
}