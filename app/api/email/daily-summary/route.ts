import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import AcquiaApiServiceFixed from '@/lib/acquia-api';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  const cronSecretHeader = request.headers.get('x-cron-secret');

  // Accept cron secret from either Authorization header or X-Cron-Secret header
  const providedSecret = authHeader?.replace('Bearer ', '') || cronSecretHeader;

  if (providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate required environment variables
  const fromEmail = process.env.FROM_EMAIL;
  if (!fromEmail) {
    console.error('❌ FROM_EMAIL environment variable not configured');
    return NextResponse.json({
      error: 'FROM_EMAIL environment variable is required for email functionality'
    }, { status: 500 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('❌ ADMIN_EMAIL environment variable not configured');
    return NextResponse.json({
      error: 'ADMIN_EMAIL environment variable is required for email functionality'
    }, { status: 500 });
  }

  try {
    // Calculate current month metrics
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const monthProgress = dayOfMonth / daysInMonth;

    // Get entitlements from env
    const viewsEntitlement = parseInt(process.env.NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT || '0');
    const visitsEntitlement = parseInt(process.env.NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT || '0');

    // Expected usage at this point in month
    const expectedViews = Math.round(viewsEntitlement * monthProgress);
    const expectedVisits = Math.round(visitsEntitlement * monthProgress);

    // Fetch actual usage (you'll need to implement this)
    const actualUsage = await fetchCurrentMonthUsage();

    // Calculate percentages
    const viewsPercentage = (actualUsage.views / viewsEntitlement) * 100;
    const visitsPercentage = (actualUsage.visits / visitsEntitlement) * 100;

    const viewsOnTrack = actualUsage.views <= expectedViews;
    const visitsOnTrack = actualUsage.visits <= expectedVisits;

    console.log('🧪 Email configuration:', {
      hasResendKey: !!process.env.RESEND_API_KEY,
      resendKeyPreview: process.env.RESEND_API_KEY?.substring(0, 10) + '...',
      fromEmail,
      adminEmail
    });

    // Send email
    console.log('📧 Attempting to send email...');
    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: [adminEmail],
      subject: `CHURRO Daily Summary - ${now.toLocaleDateString()}`,
      replyTo: 'sws-developers@lists.stanford.edu',
      html: generateEmailHTML({
        date: now,
        monthProgress: monthProgress * 100,
        dayOfMonth,
        daysInMonth,
        actualUsage,
        expectedViews,
        expectedVisits,
        viewsEntitlement,
        visitsEntitlement,
        viewsPercentage,
        visitsPercentage,
        viewsOnTrack,
        visitsOnTrack
      })
    });

    console.log('📧 Full Resend response:', JSON.stringify(emailResult, null, 2));

    if (emailResult.error) {
      console.error('❌ Resend error:', emailResult.error);
      throw new Error(`Email sending failed: ${JSON.stringify(emailResult.error)}`);
    }

    console.log('✅ Email sent successfully!', {
      messageId: emailResult.data?.id,
      to: adminEmail,
      from: fromEmail
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email sending failed:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}

async function fetchCurrentMonthUsage() {
  try {
    const subscriptionUuid = process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID;
    if (!subscriptionUuid) {
      throw new Error('NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID not configured');
    }

    // Create Acquia API service instance
    const acquiaService = new AcquiaApiServiceFixed({
      baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
      authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
      apiKey: process.env.ACQUIA_API_KEY!,
      apiSecret: process.env.ACQUIA_API_SECRET!,
    });

    // Calculate current month date range
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Use yesterday as the end date to avoid "future date" errors
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const from = firstOfMonth.toISOString().split('T')[0]; // YYYY-MM-DD format
    const to = yesterday.toISOString().split('T')[0]; // Yesterday

    console.log(`📅 Fetching usage data from ${from} to ${to}`);

    // Fetch all applications to get the list
    const applications = await acquiaService.getApplications();
    console.log(`📱 Found ${applications.length} applications`);

    // Fetch all data once (more efficient than per-application calls)
    const allViewsData = await acquiaService.getViewsDataByApplication(subscriptionUuid, from, to);
    const allVisitsData = await acquiaService.getVisitsDataByApplication(subscriptionUuid, from, to);

    let totalViews = 0;
    let totalVisits = 0;

    // Aggregate data across all applications
    for (const app of applications) {
      try {
        // Filter views data for this application
        const appViews = allViewsData
          .filter(item => item.applicationUuid === app.uuid)
          .reduce((sum: number, item: any) => sum + item.views, 0);
        totalViews += appViews;

        // Filter visits data for this application
        const appVisits = allVisitsData
          .filter(item => item.applicationUuid === app.uuid)
          .reduce((sum: number, item: any) => sum + item.visits, 0);
        totalVisits += appVisits;

        console.log(`📊 App ${app.name}: ${appViews} views, ${appVisits} visits`);
      } catch (error) {
        console.warn(`⚠️ Failed to process data for app ${app.uuid}:`, error);
        // Continue with other applications
      }
    }

    console.log(`📈 Total usage: ${totalViews} views, ${totalVisits} visits`);

    return {
      views: totalViews,
      visits: totalVisits
    };
  } catch (error) {
    console.error('❌ Error fetching current month usage:', error);
    // Return zeros to prevent email failure, but include error in email
    return {
      views: 0,
      visits: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function generateEmailHTML(data: any) {
  const statusIcon = (isOnTrack: boolean) => isOnTrack ? '✅' : '⚠️';
  const statusText = (isOnTrack: boolean) => isOnTrack ? 'On track' : 'Over expected usage';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Source Sans Pro', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #8C1515; border-bottom: 3px solid #8C1515; padding-bottom: 10px; }
        h2 { color: #2e2d29; margin-top: 30px; }
        .metric-box { background: #f8f9fa; border-left: 4px solid #8C1515; padding: 15px; margin: 10px 0; }
        .on-track { border-left-color: #28a745; }
        .over-usage { border-left-color: #dc3545; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; }
      </style>
    </head>
    <body>
      <h1>🥧 CHURRO Daily Usage Summary</h1>
      <p><strong>Date:</strong> ${data.date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}</p>
      <p><strong>Month Progress:</strong> Day ${data.dayOfMonth} of ${data.daysInMonth} (${data.monthProgress.toFixed(1)}% complete)</p>

      <h2>📈 Views Usage</h2>
      <div class="metric-box ${data.viewsOnTrack ? 'on-track' : 'over-usage'}">
        <p><strong>Current Usage:</strong> ${data.actualUsage.views.toLocaleString()} / ${data.viewsEntitlement.toLocaleString()} total (${data.viewsPercentage.toFixed(1)}%)</p>
        <p><strong>Expected at this point:</strong> ${data.expectedViews.toLocaleString()} (${((data.expectedViews / data.viewsEntitlement) * 100).toFixed(1)}%)</p>
        <p><strong>Status:</strong> ${statusIcon(data.viewsOnTrack)} ${statusText(data.viewsOnTrack)}</p>
        ${!data.viewsOnTrack ? `<p><strong>Overage:</strong> ${(data.actualUsage.views - data.expectedViews).toLocaleString()} views over expected</p>` : ''}
      </div>

      <h2>👥 Visits Usage</h2>
      <div class="metric-box ${data.visitsOnTrack ? 'on-track' : 'over-usage'}">
        <p><strong>Current Usage:</strong> ${data.actualUsage.visits.toLocaleString()} / ${data.visitsEntitlement.toLocaleString()} total (${data.visitsPercentage.toFixed(1)}%)</p>
        <p><strong>Expected at this point:</strong> ${data.expectedVisits.toLocaleString()} (${((data.expectedVisits / data.visitsEntitlement) * 100).toFixed(1)}%)</p>
        <p><strong>Status:</strong> ${statusIcon(data.visitsOnTrack)} ${statusText(data.visitsOnTrack)}</p>
        ${!data.visitsOnTrack ? `<p><strong>Overage:</strong> ${(data.actualUsage.visits - data.expectedVisits).toLocaleString()} visits over expected</p>` : ''}
      </div>

      ${data.actualUsage.error ? `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>⚠️ Data Collection Warning:</strong></p>
          <p>There was an issue collecting usage data: ${data.actualUsage.error}</p>
          <p>Values shown may be incomplete. Please check the dashboard manually.</p>
        </div>
      ` : ''}

      <div class="footer">
        <p><strong>Generated by CHURRO</strong> - Stanford University Cloud Hosting Usage Reporting</p>
        <p>For more details, visit the <a href="${process.env.APP_URL || 'https://churro.stanford.edu'}">CHURRO Dashboard</a></p>
      </div>
    </body>
    </html>
  `;
}