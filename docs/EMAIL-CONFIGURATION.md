# CHURRO Environment Variables Configuration

## Required Environment Variables

Add these to your Vercel project environment variables or `.env.local` for development:

### Acquia API Configuration
```bash
# Acquia Cloud API credentials (OAuth2)
ACQUIA_API_KEY=your-api-key-uuid
ACQUIA_API_SECRET=your-api-secret

# API endpoints (optional - uses defaults if not specified)
ACQUIA_API_BASE_URL=https://cloud.acquia.com/api
ACQUIA_AUTH_BASE_URL=https://accounts.acquia.com/api

# Subscription and entitlements
NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID=your-subscription-uuid
NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT=30000000
NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT=9000000
```

### SAML Authentication (if using)
```bash
# SAML certificates and configuration
SAML_CERT=your-stanford-cert
SAML_SP_CERT=your-sp-cert
SAML_SP_PRIVATE_KEY=your-sp-private-key

# Application URLs
APP_URL=https://your-domain.vercel.app
SAML_ENTITY_ID=https://your-entity-id

# JWT for session management
JWT_SECRET=your-jwt-secret-generate-with-openssl-rand-base64-32
```

### Email Reporting Configuration
```bash
# Email service (Resend.com)
RESEND_API_KEY=re_xxxxxxxxxx

# Email configuration
FROM_EMAIL=onboarding@resend.dev  # Use for testing, or verify your own domain
ADMIN_EMAIL=your-email@stanford.edu

# For production with verified domain
# FROM_EMAIL=noreply@your-verified-domain.com

# Note: Stanford DMARC requires Stanford IT to configure DKIM for @stanford.edu addresses
# See Stanford email authentication docs for production setup

# Cron job security
CRON_SECRET=your-secure-random-key-for-cron-protection
```

## Setup Instructions

### 1. Resend Email Service
1. Sign up at [resend.com](https://resend.com)
2. Create an API key
3. Add `RESEND_API_KEY` to your environment

### 2. Generate CRON_SECRET
```bash
# Generate a secure random key
openssl rand -base64 32
```

### 3. Configure Vercel Environment Variables
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable with appropriate values
3. Set environment scope (Development/Preview/Production as needed)

## Email Testing

To test the daily summary email manually, call the same endpoint used by the Vercel cron job. All calls — including Vercel cron — must provide `CRON_SECRET` via `Authorization: Bearer`:

```bash
# Trigger manually
curl -X GET "https://your-domain.vercel.app/api/email/daily-summary" \
  -H "Authorization: Bearer your-cron-secret"

# Local development
curl -X GET "http://localhost:3000/api/email/daily-summary" \
  -H "Authorization: Bearer your-cron-secret"
```

**Security Note**: `/api/email/daily-summary` requires `CRON_SECRET` via `Authorization: Bearer` for all requests. Vercel automatically sends this header with cron invocations when `CRON_SECRET` is set in the environment — no additional configuration is needed.

## Data Collection Details

**Data Lag Handling**: The email accounts for Acquia's data processing delays by using a 2-day offset when possible, but always ensures data stays within the current month:

- **Day 1**: Uses current day only (no previous data available)
- **Day 2**: Uses first day only (2-day offset would cross to previous month)
- **Day 3**: Uses first day only (2-day offset would be previous month)
- **Day 4+**: Uses 2-day offset (e.g., Day 4 reports through Day 2)

**Month Boundary Protection**: Never includes data from the previous month to ensure accurate monthly usage tracking

**Date Range**: Reports data from the 1st of the current month through the calculated end date based on data availability

**Data Aggregation**: Combines views and visits across all applications in your Acquia subscription

**Calculations**:
- Month progress: Current day / Total days in month
- Expected usage: Entitlement × Month progress percentage
- Status: "On track" if actual usage ≤ expected usage

## Cron Schedule

The current schedule in `vercel.json` runs daily at 5 PM UTC (9 AM PST / 10 AM PDT):
```json
{
  "crons": [
    {
      "path": "/api/email/daily-summary",
      "schedule": "0 17 * * *"
    }
  ]
}
```

**How Vercel Cron Authentication Works**:
- Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` with every cron invocation when `CRON_SECRET` is set in the environment
- The endpoint requires this header for all callers — cron and manual alike — so there is no spoofable fallback path
- No additional configuration needed in `vercel.json`

### Common Cron Schedules
- `0 17 * * *` - 5 PM UTC daily (9 AM PST / 10 AM PDT) ← current
- `0 9 * * *` - 9 AM UTC daily (1 AM PST)
- `0 8 * * 1-5` - 8 AM UTC, Monday-Friday only
- `0 10 * * *` - 10 AM UTC daily

## Security Notes

1. **CRON_SECRET**: Prevents unauthorized access to the email endpoint
2. **Environment Variables**: Never commit secrets to version control
3. **API Keys**: Use environment-specific keys (dev/staging/prod)
4. **Email Recipients**: Consider using distribution lists for multiple recipients

## Troubleshooting

### Common Issues
1. **Email not sending**: Check `RESEND_API_KEY` is valid
2. **Unauthorized cron calls**: Verify `CRON_SECRET` matches between Vercel environment and request header
3. **401 on manual test call**: Ensure `CRON_SECRET` is set in Vercel environment variables and passed as `Authorization: Bearer <CRON_SECRET>`
4. **No data in email**: Check Acquia API credentials and permissions
5. **Wrong timezone**: Cron runs in UTC, adjust schedule accordingly

### Logs
Check Vercel function logs for:
- Authentication errors with Acquia API
- Email sending failures
- Data aggregation issues