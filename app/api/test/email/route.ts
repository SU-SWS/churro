import { NextRequest, NextResponse } from 'next/server';
import { sendDailySummaryEmail } from '@/lib/email-service';

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({
        error: 'CRON_SECRET not configured. Add this environment variable to test email functionality.'
      }, { status: 500 });
    }

    console.log('🧪 Triggering test email via direct function call...');

    // Call the shared email service function directly (no HTTP request needed)
    const result = await sendDailySummaryEmail();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully!',
        details: result
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to send test email',
        error: result
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Test email failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Error sending test email',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}