import { Resend } from 'resend';
import AcquiaApiServiceFixed from '@/lib/acquia-api';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailServiceResult {
  success: boolean;
  message: string;
  emailId?: string;
  data?: any;
  error?: string;
}

export async function sendDailySummaryEmail(): Promise<EmailServiceResult> {
  try {
    // Validate required environment variables
    const fromEmail = process.env.FROM_EMAIL;
    if (!fromEmail) {
      console.error('❌ FROM_EMAIL environment variable not configured');
      return {
        success: false,
        message: 'FROM_EMAIL environment variable is required for email functionality',
        error: 'Missing FROM_EMAIL'
      };
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.error('❌ ADMIN_EMAIL environment variable not configured');
      return {
        success: false,
        message: 'ADMIN_EMAIL environment variable is required for email functionality',
        error: 'Missing ADMIN_EMAIL'
      };
    }

    const subscriptionUuid = process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID;
    if (!subscriptionUuid) {
      console.error('❌ NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID environment variable not configured');
      return {
        success: false,
        message: 'NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID environment variable is required',
        error: 'Missing subscription UUID'
      };
    }

    // Get monthly entitlements
    const monthlyViewsEntitlement = parseInt(process.env.NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT || '30000000', 10);
    const monthlyVisitsEntitlement = parseInt(process.env.NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT || '9000000', 10);

    console.log('📧 Starting daily summary email generation...');

    // Fetch current month usage data
    const usageData = await fetchCurrentMonthUsage(subscriptionUuid);

    if (!usageData) {
      console.error('❌ Failed to fetch usage data from Acquia API');
      return {
        success: false,
        message: 'Failed to fetch usage data from Acquia API',
        error: 'API fetch failed'
      };
    }

    // Calculate month progress and expected usage
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthProgress = (currentDay / daysInMonth) * 100;

    // Calculate expected usage at this point in the month
    const expectedViews = Math.round(monthlyViewsEntitlement * (currentDay / daysInMonth));
    const expectedVisits = Math.round(monthlyVisitsEntitlement * (currentDay / daysInMonth));

    // Calculate percentages of entitlements used
    const viewsPercentage = (usageData.totalViews / monthlyViewsEntitlement) * 100;
    const visitsPercentage = (usageData.totalVisits / monthlyVisitsEntitlement) * 100;

    // Determine status
    const viewsStatus = usageData.totalViews <= expectedViews ? 'On track' : 'Over expected pace';
    const visitsStatus = usageData.totalVisits <= expectedVisits ? 'On track' : 'Over expected pace';

    const emailData = {
      views: {
        actual: usageData.totalViews,
        percentage: viewsPercentage,
        expected: expectedViews,
        entitlement: monthlyViewsEntitlement,
        status: viewsStatus
      },
      visits: {
        actual: usageData.totalVisits,
        percentage: visitsPercentage,
        expected: expectedVisits,
        entitlement: monthlyVisitsEntitlement,
        status: visitsStatus
      },
      monthProgress: monthProgress,
      currentDay: currentDay,
      daysInMonth: daysInMonth,
      reportDate: now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    };

    // Generate and send email
    const emailHTML = generateEmailHTML(emailData);

    console.log('📧 Sending daily summary email...');
    const result = await resend.emails.send({
      from: fromEmail,
      to: [adminEmail],
      subject: `CHURRO Daily Usage Summary - ${emailData.reportDate}`,
      html: emailHTML,
    });

    if (result.error) {
      console.error('❌ Failed to send email:', result.error);
      return {
        success: false,
        message: 'Failed to send email',
        error: result.error.message || 'Unknown email error'
      };
    }

    console.log('✅ Daily summary email sent successfully!', result.data?.id);

    return {
      success: true,
      message: 'Daily summary email sent successfully',
      emailId: result.data?.id,
      data: emailData
    };

  } catch (error) {
    console.error('❌ Error in sendDailySummaryEmail:', error);
    return {
      success: false,
      message: 'Error sending daily summary email',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchCurrentMonthUsage(subscriptionUuid: string) {
  try {
    console.log('📊 Fetching current month usage data...');

    // Get current month date range (from 1st to yesterday to avoid "future date" API errors)
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const fromDate = firstDayOfMonth.toISOString().split('T')[0]; // YYYY-MM-DD format
    const toDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log(`📊 Fetching data from ${fromDate} to ${toDate}`);

    // Initialize Acquia API service
    const acquiaService = new AcquiaApiServiceFixed({
      baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
      authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
      apiKey: process.env.ACQUIA_API_KEY || '',
      apiSecret: process.env.ACQUIA_API_SECRET || ''
    });

    // Fetch data for current month
    const [viewsData, visitsData] = await Promise.all([
      acquiaService.getViewsDataByApplication(subscriptionUuid, fromDate, toDate),
      acquiaService.getVisitsDataByApplication(subscriptionUuid, fromDate, toDate)
    ]);

    // Calculate totals
    const totalViews = viewsData.reduce((sum, item) => sum + (item.views || 0), 0);
    const totalVisits = visitsData.reduce((sum, item) => sum + (item.visits || 0), 0);

    console.log(`📊 Current month usage: ${totalViews.toLocaleString()} views, ${totalVisits.toLocaleString()} visits`);

    return {
      totalViews,
      totalVisits,
      viewsData,
      visitsData,
      dateRange: { from: fromDate, to: toDate }
    };

  } catch (error) {
    console.error('❌ Error fetching current month usage:', error);
    return null;
  }
}

function generateEmailHTML(data: any): string {
  const { views, visits, monthProgress, currentDay, daysInMonth, reportDate } = data;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CHURRO Daily Usage Summary</title>
      <style>
        body {
          font-family: 'Source Sans Pro', Arial, sans-serif;
          line-height: 1.6;
          color: #2e2d29;
          background-color: #f4f4f1;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background-color: #8c1515;
          color: #ffffff;
          text-align: center;
          padding: 30px 20px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }
        .content {
          padding: 30px;
        }
        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          margin: 15px 0;
          border-radius: 6px;
          border-left: 4px solid #8c1515;
        }
        .metric-row.views {
          background-color: #f9f6f2;
        }
        .metric-row.visits {
          background-color: #f4f1f9;
        }
        .metric-label {
          font-weight: 600;
          font-size: 18px;
          color: #8c1515;
        }
        .metric-value {
          text-align: right;
          flex: 1;
          margin-left: 20px;
        }
        .metric-number {
          font-size: 24px;
          font-weight: 700;
          color: #2e2d29;
          display: block;
        }
        .metric-percentage {
          font-size: 14px;
          color: #767676;
          display: block;
        }
        .status-indicator {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          margin-top: 5px;
          display: inline-block;
        }
        .status-on-track {
          background-color: #d4edda;
          color: #155724;
        }
        .status-over {
          background-color: #f8d7da;
          color: #721c24;
        }
        .progress-section {
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 6px;
          margin: 20px 0;
          text-align: center;
        }
        .progress-bar {
          background-color: #e0e0e0;
          height: 20px;
          border-radius: 10px;
          overflow: hidden;
          margin: 10px 0;
        }
        .progress-fill {
          background-color: #8c1515;
          height: 100%;
          transition: width 0.3s ease;
        }
        .footer {
          background-color: #f8f8f8;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #767676;
        }
        .stanford-branding {
          color: #8c1515;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 CHURRO Daily Usage Summary</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${reportDate}</p>
        </div>

        <div class="content">
          <div class="progress-section">
            <h3 style="margin: 0 0 10px 0; color: #8c1515;">Month Progress</h3>
            <p style="margin: 0; font-size: 16px;">Day ${currentDay} of ${daysInMonth} (${monthProgress.toFixed(1)}% complete)</p>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(monthProgress, 100)}%;"></div>
            </div>
          </div>

          <div class="metric-row views">
            <div class="metric-label">
              📈 Views
            </div>
            <div class="metric-value">
              <span class="metric-number">${views.actual.toLocaleString()}</span>
              <span class="metric-percentage">${views.percentage.toFixed(1)}% of ${views.entitlement.toLocaleString()} monthly limit</span>
              <span class="status-indicator ${views.status === 'On track' ? 'status-on-track' : 'status-over'}">
                ${views.status}
              </span>
            </div>
          </div>

          <div class="metric-row visits">
            <div class="metric-label">
              👥 Visits
            </div>
            <div class="metric-value">
              <span class="metric-number">${visits.actual.toLocaleString()}</span>
              <span class="metric-percentage">${visits.percentage.toFixed(1)}% of ${visits.entitlement.toLocaleString()} monthly limit</span>
              <span class="status-indicator ${visits.status === 'On track' ? 'status-on-track' : 'status-over'}">
                ${visits.status}
              </span>
            </div>
          </div>

          <div style="margin-top: 30px; padding: 15px; background-color: #f0f8ff; border-radius: 6px; border-left: 4px solid #0066cc;">
            <p style="margin: 0; font-size: 14px; color: #2e2d29;">
              <strong>Expected usage at ${monthProgress.toFixed(1)}% through month:</strong><br>
              Views: ${views.expected.toLocaleString()} | Visits: ${visits.expected.toLocaleString()}
            </p>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 0;">
            Generated by <span class="stanford-branding">CHURRO</span>
            (Cloud Hosting Usage Reporting with Recurring Output)<br>
            Stanford University Web Services
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}