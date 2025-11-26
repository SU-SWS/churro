import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the current URL to construct the cron endpoint
    const { origin } = new URL(request.url);
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({
        error: 'CRON_SECRET not configured. Add this environment variable to test email functionality.'
      }, { status: 500 });
    }

    console.log('🧪 Triggering test email...');

    // Call the daily summary endpoint with basic auth credentials
    const basicAuthUsername = process.env.BASIC_AUTH_USERNAME;
    const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD;

    if (!basicAuthUsername || !basicAuthPassword) {
      return NextResponse.json({
        error: 'BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD environment variables are required'
      }, { status: 500 });
    }

    const response = await fetch(`${origin}/api/email/daily-summary`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${basicAuthUsername}:${basicAuthPassword}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'X-Cron-Secret': cronSecret, // Use custom header for cron secret
      },
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    // Check if response is HTML (indicating middleware rejection)
    const responseText = await response.text();
    console.log('📊 Response text preview:', responseText.substring(0, 200));

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON:', parseError);
      return NextResponse.json({
        success: false,
        message: 'Received non-JSON response (likely HTML from middleware)',
        responseStatus: response.status,
        responsePreview: responseText.substring(0, 500)
      }, { status: 500 });
    }

    if (response.ok) {
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
      }, { status: response.status });
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