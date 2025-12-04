import { Resend } from 'resend';
import AcquiaApiServiceFixed from '@/lib/acquia-api';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Escapes HTML characters to prevent XSS attacks
 * @param text - Text to escape
 * @returns Escaped text safe for HTML insertion
 */
function escapeHtml(text: string | number): string {
  const str = String(text);
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return str.replace(/[&<>"'\/]/g, (char) => htmlEscapeMap[char] || char);
}

interface UsageMetric {
  actual: number;
  percentage: number;
  expected: number;
  entitlement: number;
  status: 'On track' | 'Over expected pace';
}

interface EmailData {
  views: UsageMetric;
  visits: UsageMetric;
  monthProgress: number;
  currentDay: number;
  daysInMonth: number;
  reportDate: string;
}

interface EmailServiceResult {
  success: boolean;
  message: string;
  emailId?: string;
  data?: EmailData;
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

    // Validate entitlement values to prevent division by zero
    if (monthlyViewsEntitlement <= 0) {
      console.error('❌ NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT must be greater than zero');
      return {
        success: false,
        message: 'Invalid views entitlement configuration - must be greater than zero',
        error: 'Invalid views entitlement'
      };
    }

    if (monthlyVisitsEntitlement <= 0) {
      console.error('❌ NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT must be greater than zero');
      return {
        success: false,
        message: 'Invalid visits entitlement configuration - must be greater than zero',
        error: 'Invalid visits entitlement'
      };
    }

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
    const viewsStatus: 'On track' | 'Over expected pace' = usageData.totalViews <= expectedViews ? 'On track' : 'Over expected pace';
    const visitsStatus: 'On track' | 'Over expected pace' = usageData.totalVisits <= expectedVisits ? 'On track' : 'Over expected pace';

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

    // Get current month date range accounting for data processing delays
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Handle first day of month edge case and cross-month boundaries
    let toDate: string;
    let fromDate: string;

    if (now.getDate() === 1) {
      // On the first day, we don't have any previous days in this month to query
      // Use the first day as both start and end date to get zero values
      toDate = firstDayOfMonth.toISOString().split('T')[0];
      fromDate = firstDayOfMonth.toISOString().split('T')[0];
      console.log(`📊 First day of month detected - using current day for date range`);
    } else if (now.getDate() === 2) {
      // On the second day, 2-day offset would go to previous month
      // Use first day of current month through first day only
      fromDate = firstDayOfMonth.toISOString().split('T')[0];
      toDate = firstDayOfMonth.toISOString().split('T')[0];
      console.log(`📊 Second day of month detected - using first day only to avoid previous month`);
    } else {
      // Use 2-day offset for data availability, but ensure we don't cross month boundary
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      if (twoDaysAgo.getMonth() !== now.getMonth()) {
        // 2-day offset crosses into previous month, use first day of current month instead
        fromDate = firstDayOfMonth.toISOString().split('T')[0];
        toDate = firstDayOfMonth.toISOString().split('T')[0];
        console.log(`📊 2-day offset crosses month boundary - using first day only`);
      } else {
        // Safe to use 2-day offset within current month
        fromDate = firstDayOfMonth.toISOString().split('T')[0];
        toDate = twoDaysAgo.toISOString().split('T')[0];
        console.log(`📊 Using 2-day offset for data availability - querying through ${toDate}`);
      }
    }

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

function generateEmailHTML(data: EmailData): string {
  const { views, visits, monthProgress, currentDay, daysInMonth, reportDate } = data;

  // Escape all dynamic content for security
  const safeReportDate = escapeHtml(reportDate);
  const safeCurrentDay = escapeHtml(currentDay);
  const safeDaysInMonth = escapeHtml(daysInMonth);
  const safeMonthProgress = escapeHtml(monthProgress.toFixed(1));

  // Views data with escaping
  const safeViewsActual = escapeHtml(views.actual.toLocaleString());
  const safeViewsPercentage = escapeHtml(views.percentage.toFixed(1));
  const safeViewsEntitlement = escapeHtml(views.entitlement.toLocaleString());
  const safeViewsStatus = escapeHtml(views.status);
  const safeViewsExpected = escapeHtml(views.expected.toLocaleString());

  // Visits data with escaping
  const safeVisitsActual = escapeHtml(visits.actual.toLocaleString());
  const safeVisitsPercentage = escapeHtml(visits.percentage.toFixed(1));
  const safeVisitsEntitlement = escapeHtml(visits.entitlement.toLocaleString());
  const safeVisitsStatus = escapeHtml(visits.status);
  const safeVisitsExpected = escapeHtml(visits.expected.toLocaleString());

  // Safe progress width for CSS style attribute
  const safeProgressWidth = escapeHtml(Math.min(monthProgress, 100).toFixed(1));

  // Validate status values for safe conditional logic
  const isViewsOnTrack = views.status === 'On track';
  const isVisitsOnTrack = visits.status === 'On track';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CHURRO Daily Usage Summary - ${safeReportDate}</title>
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
        .metric-table {
          width: 100%;
          margin: 15px 0;
          border-radius: 6px;
          border-left: 4px solid #8c1515;
          border-collapse: collapse;
          overflow: hidden;
        }
        .metric-table.views {
          background-color: #f9f6f2;
        }
        .metric-table.visits {
          background-color: #f4f1f9;
        }
        .metric-table td {
          padding: 20px;
          vertical-align: middle;
        }
        .metric-label {
          font-weight: 600;
          font-size: 18px;
          color: #8c1515;
          width: 120px;
        }
        .metric-value {
          text-align: right;
          width: auto;
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
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .skip-link {
          position: absolute;
          top: -40px;
          left: 6px;
          background: #000;
          color: #fff;
          padding: 8px;
          text-decoration: none;
          z-index: 1000;
        }
        .skip-link:focus {
          top: 6px;
        }
      </style>
    </head>
    <body>
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <div class="container" role="main">
        <header class="header" role="banner">
          <h1><span aria-hidden="true">📊</span> CHURRO Daily Usage Summary</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${safeReportDate}</p>
        </header>

        <main class="content" id="main-content">
          <section class="progress-section" aria-labelledby="progress-heading">
            <h2 id="progress-heading" style="margin: 0 0 10px 0; color: #8c1515; font-size: 18px;">Month Progress</h2>
            <p style="margin: 0; font-size: 16px;">Day ${safeCurrentDay} of ${safeDaysInMonth} (${safeMonthProgress}% complete)</p>
            <div class="progress-bar" role="progressbar" aria-valuenow="${safeMonthProgress}" aria-valuemin="0" aria-valuemax="100" aria-label="Month progress: ${safeMonthProgress}% complete">
              <div class="progress-fill" style="width: ${safeProgressWidth}%;"></div>
            </div>
            <p class="sr-only">Progress bar showing ${safeMonthProgress}% of the month has elapsed</p>
          </section>

          <table class="metric-table views" cellpadding="0" cellspacing="0" role="table" aria-labelledby="views-caption">
            <caption id="views-caption" class="sr-only">Website Views Usage Summary</caption>
            <thead class="sr-only">
              <tr>
                <th scope="col">Metric Type</th>
                <th scope="col">Current Usage and Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" class="metric-label">
                  <span aria-hidden="true">📈</span> Views
                </th>
                <td class="metric-value">
                  <span class="metric-number">${safeViewsActual}</span>
                  <span class="metric-percentage">${safeViewsPercentage}% of ${safeViewsEntitlement} monthly limit</span>
                  <span class="status-indicator ${isViewsOnTrack ? 'status-on-track' : 'status-over'}" role="status" aria-label="Status: ${safeViewsStatus}">
                    <span aria-hidden="true">${isViewsOnTrack ? '✓' : '⚠'}</span> ${safeViewsStatus}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <table class="metric-table visits" cellpadding="0" cellspacing="0" role="table" aria-labelledby="visits-caption">
            <caption id="visits-caption" class="sr-only">Website Visits Usage Summary</caption>
            <thead class="sr-only">
              <tr>
                <th scope="col">Metric Type</th>
                <th scope="col">Current Usage and Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" class="metric-label">
                  <span aria-hidden="true">👥</span> Visits
                </th>
                <td class="metric-value">
                  <span class="metric-number">${safeVisitsActual}</span>
                  <span class="metric-percentage">${safeVisitsPercentage}% of ${safeVisitsEntitlement} monthly limit</span>
                  <span class="status-indicator ${isVisitsOnTrack ? 'status-on-track' : 'status-over'}" role="status" aria-label="Status: ${safeVisitsStatus}">
                    <span aria-hidden="true">${isVisitsOnTrack ? '✓' : '⚠'}</span> ${safeVisitsStatus}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <section style="margin-top: 30px; padding: 15px; background-color: #f0f8ff; border-radius: 6px; border-left: 4px solid #0066cc;" aria-labelledby="expected-usage">
            <h3 id="expected-usage" style="margin: 0 0 5px 0; font-size: 14px; font-weight: bold; color: #2e2d29;">Expected Usage Comparison</h3>
            <p style="margin: 0; font-size: 14px; color: #2e2d29;">
              At ${safeMonthProgress}% through the month, expected usage should be:<br>
              Views: ${safeViewsExpected} | Visits: ${safeVisitsExpected}
            </p>
          </section>
        </main>

        <footer class="footer" role="contentinfo">
          <p style="margin: 0;">
            Generated by <a href="https://churro.stanford.edu" style="color: #8c1515; font-weight: 600; text-decoration: none;"><abbr title="Cloud Hosting Usage Reporting with Recurring Output">CHURRO</abbr></a><br>
            Stanford Web Services
          </p>
        </footer>
      </div>
    </body>
    </html>
  `;
}