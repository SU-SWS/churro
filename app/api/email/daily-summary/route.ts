import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Send email
    await resend.emails.send({
      from: 'CHURRO <noreply@yourdomain.com>',
      to: ['your-email@stanford.edu'],
      subject: `CHURRO Daily Summary - ${now.toLocaleDateString()}`,
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email sending failed:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}

async function fetchCurrentMonthUsage() {
  // Implement your logic to fetch current month's views/visits
  // This would call your existing Acquia API endpoints
  const subscriptionUuid = process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID;

  // You'll need to aggregate data across all applications
  // Return format: { views: number, visits: number }
  return { views: 0, visits: 0 }; // Placeholder
}

function generateEmailHTML(data: any) {
  return `
    <h1>CHURRO Daily Usage Summary</h1>
    <p><strong>Date:</strong> ${data.date.toLocaleDateString()}</p>
    <p><strong>Month Progress:</strong> ${data.dayOfMonth}/${data.daysInMonth} days (${data.monthProgress.toFixed(1)}%)</p>

    <h2>Views Usage</h2>
    <p><strong>Actual:</strong> ${data.actualUsage.views.toLocaleString()} / ${data.viewsEntitlement.toLocaleString()} (${data.viewsPercentage.toFixed(1)}%)</p>
    <p><strong>Expected at this point:</strong> ${data.expectedViews.toLocaleString()}</p>
    <p><strong>Status:</strong> ${data.viewsOnTrack ? '✅ On track' : '⚠️ Over expected usage'}</p>

    <h2>Visits Usage</h2>
    <p><strong>Actual:</strong> ${data.actualUsage.visits.toLocaleString()} / ${data.visitsEntitlement.toLocaleString()} (${data.visitsPercentage.toFixed(1)}%)</p>
    <p><strong>Expected at this point:</strong> ${data.expectedVisits.toLocaleString()}</p>
    <p><strong>Status:</strong> ${data.visitsOnTrack ? '✅ On track' : '⚠️ Over expected usage'}</p>
  `;
}