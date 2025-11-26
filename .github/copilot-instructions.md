# CHURRO - AI Development Guidelines

## Project Overview
**CHURRO** (Cloud Hosting Usage Reporting with Recurring Output) is a Next.js 15 dashboard for visualizing Acquia Cloud hosting analytics (views/visits data). Built for Stanford University with Stanford Design System (Decanter) styling, basic HTTP authentication, and daily email reporting.

## Architecture

### Tech Stack
- **Framework**: Next.js 15.5+ (App Router only, no Pages Router)
- **Runtime**: Node.js 22.x (enforced via package.json engines)
- **Styling**: TailwindCSS with Decanter preset (Stanford Design System)
- **Authentication**: Basic HTTP Authentication via middleware
- **Data Viz**: Recharts for charts/graphs
- **Email**: Resend.com for daily summary emails
- **Deployment**: Vercel

### Key Components

**API Routes** (`app/api/`):
- `/api/acquia/applications` - Fetches all Acquia applications
- `/api/acquia/visits` - Fetches visits metrics with pagination
- `/api/acquia/views` - Fetches views metrics with pagination
- `/api/email/daily-summary` - Sends daily usage summary emails (cron job)
- `/api/test/email` - Test endpoint for email functionality

**Core Services** (`lib/`):
- `lib/acquia-api.ts` - Acquia Cloud API client with 6-hour caching and pagination

**Data Flow**:
1. User accesses application → Basic auth via middleware
2. Dashboard fetches from `/api/acquia/*` routes
3. API routes use `AcquiaApiServiceFixed` with OAuth2 client_credentials flow
4. Response data parsed from Acquia's nested `_embedded.items[].datapoints[]` structure
5. Data cached in-memory for 6 hours with cache keys based on query params

## Development Patterns

### Environment Variables
**Required** (stored in `.env.local`, never committed):
- `ACQUIA_API_KEY` / `ACQUIA_API_SECRET` - OAuth2 credentials (no quotes)
- `ACQUIA_API_BASE_URL` / `ACQUIA_AUTH_BASE_URL` - API endpoints (optional, defaults provided)
- `NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID` - Subscription identifier
- `NEXT_PUBLIC_ACQUIA_MONTHLY_{VIEWS|VISITS}_ENTITLEMENT` - Usage limits
- `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` - Basic HTTP authentication credentials

**Email Reporting** (optional, for daily summary emails):
- `RESEND_API_KEY` - Resend.com API key for email delivery
- `FROM_EMAIL` - Sender email address (use onboarding@resend.dev for testing)
- `ADMIN_EMAIL` - Recipient email for daily summaries
- `CRON_SECRET` - Protects cron endpoint from unauthorized access
- `APP_URL` - Application URL for email links (optional, inferred from request)

**Critical**: Values must NOT have surrounding quotes. API key/secret are auto-stripped of quotes in `acquia-api.ts` (lines 91-92).

### Authentication

**Basic HTTP Authentication** (`middleware.ts`):
- Credentials: Configured via `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` environment variables
- **Required**: Must set both environment variables (no fallback values)
- Protects all routes except `/_next`, `/api/public`, `/favicon.ico`
- Allows localhost access (IPv4/IPv6) without authentication
- Returns 401 with WWW-Authenticate header for protected resources

### Stanford Design System (Decanter)

**Colors** - Use semantic Decanter tokens, NOT hex values:
- Primary: `cardinal-red` (Stanford brand red)
- Accents: `digital-blue`, `digital-green`
- Grays: `black-{10,20,60,80}`, `gc-black`
- **Never use**: Custom hex colors unless explicitly non-Stanford branding

**Typography**:
- Headings: `type-{0,1,2,3,4}` classes (defined in Decanter)
- Body: `Source_Sans_3` (imported in `app/layout.tsx`)
- Serif: `Source_Serif_4` for emphasis
- Display: Custom `stanford` font (local woff2)

**Interaction States**:
- Use `hocus:` prefix for hover+focus states (Decanter utility)
- Example: `hocus:bg-black hocus:text-white`

**Spacing**:
- Use Decanter scale: `p-{5,8,10,15,20,25,30,50}` (not arbitrary values)
- Responsive: `px-20 sm:px-30 md:px-50 lg:px-30`

### Acquia API Integration

**Authentication** (`lib/acquia-api.ts` lines 81-177):
- OAuth2 client credentials flow with 3 fallback methods
- Token cached in `this.accessToken`, auto-retries on 401
- **Debug tip**: Check lines 127-142 for auth method attempts

**Data Parsing** (`lib/acquia-api.ts` lines 312-466):
- Response structure: `_embedded.items[]` where each item = one application
- Each item has `metadata.application.uuids[0]` + `datapoints[]` array
- Datapoints format: `["2025-04-15T00:00:00+00:00", "1124"]` (date, value)
- **Critical**: ONE item = ONE application, ALL datapoints belong to that app

**Caching**:
- 6-hour in-memory cache (lines 10-24)
- Cache keys: `generateCacheKey([endpoint, uuid, from, to, resolution])`
- Cache hit returns immediately without API call

**Date Filtering** (lines 218-262):
- API expects ISO 8601: `2025-04-15T23:59:59.000Z`
- Frontend sends: `YYYY-MM-DD`
- Conversion adds `T00:00:00.000Z` (start) or `T23:59:59.000Z` (end)
- Filter format: `filter=from=2025-04-01T00:00:00.000Z,to=2025-04-30T23:59:59.000Z`

### Component Patterns

**Client Components** - Use `'use client'` directive when:
- Using React hooks (`useState`, `useEffect`)
- Browser APIs (localStorage, fetch)
- Example: `components/Dashboard.tsx` (line 1)

**Server Components** - Default for:
- Page layouts (`app/layout.tsx`, `app/page.tsx`)
- Static content rendering

**Data Fetching**:
- Client-side: `fetch('/api/acquia/visits')` from Dashboard
- Pass query params: `new URLSearchParams({ subscriptionUuid, from, to })`
- Handle loading states with `CountUpTimer` component

## Email Reporting System

**Daily Summary Emails** (`app/api/email/daily-summary/`):
- **Trigger**: Vercel cron job runs daily at 9 AM UTC (configured in `vercel.json`)
- **Data**: Aggregates views/visits across all applications for current month
- **Calculations**:
  - Month progress percentage (e.g., day 7 of 31 = 22.6%)
  - Expected usage at current point vs actual usage
  - Overage warnings when usage exceeds expected pace
- **Email Service**: Uses Resend.com for reliable delivery
- **Security**: Protected by `CRON_SECRET` to prevent unauthorized triggers

**Email Content**:
- Stanford-branded HTML email with Decanter color scheme
- Current month usage vs entitlements (Views/Visits)
- Progress tracking against monthly pace
- Visual indicators for on-track vs over-usage status
- Error handling for data collection failures

**Setup Requirements**:
1. `RESEND_API_KEY` - Sign up at resend.com
2. `FROM_EMAIL` - Sender address (use onboarding@resend.dev for testing)
3. `ADMIN_EMAIL` - Recipient for daily summaries
4. `CRON_SECRET` - Generate with `openssl rand -base64 32`
5. Configure in Vercel environment variables

**Testing**:
- Manual trigger: `GET /api/test/email` (requires CRON_SECRET)
- Check Vercel function logs for debugging
- Verify email delivery in Resend dashboard

**Cron Schedule Options** (`vercel.json`):
- `"0 9 * * *"` - 9 AM UTC daily (current)
- `"0 17 * * *"` - 5 PM UTC daily (9 AM PST)
- `"0 8 * * 1-5"` - 8 AM UTC, weekdays only

## Common Tasks

### Adding a New Chart Type
1. Create component in `components/` (e.g., `NewChart.tsx`)
2. Import Recharts primitives: `{ BarChart, Bar, XAxis, YAxis, Tooltip }`
3. Accept `data` prop with `{ name: string, value: number, uuid: string }[]`
4. Use Decanter colors: `className='fill-cardinal-red'`
5. Add tab to `Dashboard.tsx` TABS array
6. Add conditional render in tab content section

### Debugging Acquia API Issues
1. Check auth: Uncomment console.logs in `lib/acquia-api.ts` lines 95-141
2. Verify date parsing: Check logs at lines 237-251 (date formatting)
3. Inspect response structure: Logs at lines 320-330 (parsing entry point)
4. Cache debugging: Search for "Returning cached" logs

### Environment Setup

**Local Development**:
```bash
nvm use                     # Ensures Node 22.x
npm install                 # Install dependencies

# Configure environment
cp .env.example .env.local  # Create env file
# Edit .env.local:
#   ACQUIA_API_KEY=your-api-key
#   ACQUIA_API_SECRET=your-api-secret
#   NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID=your-subscription-uuid
#   RESEND_API_KEY=your-resend-key (optional)
#   FROM_EMAIL=sws-developers@lists.stanford.edu (optional)
#   ADMIN_EMAIL=admin@stanford.edu (optional)
#   CRON_SECRET=generate-with-openssl-rand-base64-32 (optional)

# Start development server
npm run dev                 # HTTP server (basic development)
```

### Setting Up Email Reporting
1. **Get Resend API Key**: Sign up at [resend.com](https://resend.com)
2. **Configure Environment Variables**:
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxx
   FROM_EMAIL=onboarding@resend.dev  # For testing
   ADMIN_EMAIL=your-email@stanford.edu
   CRON_SECRET=your-secure-random-key
   ```
3. **Test Email**: Visit `/api/test/email` to send test email
4. **Deploy**: Cron job automatically runs daily at 9 AM UTC
5. **Production**: Verify your own domain in Resend or work with Stanford IT for @stanford.edu addresses

### Modifying Email Schedule
1. Edit `vercel.json` cron schedule
2. Common patterns:
   - `"0 9 * * *"` - 9 AM UTC daily
   - `"0 17 * * *"` - 5 PM UTC daily (9 AM PST)
   - `"0 8 * * 1-5"` - 8 AM UTC, weekdays only

## File Organization

```
app/
  api/              # API routes (Next.js 15 route handlers)
    acquia/         # Acquia Cloud API proxy routes
    email/          # Email functionality
      daily-summary/ # Daily summary cron job
    test/           # Testing endpoints
      email/        # Email testing
  [pages]           # Page components (e.g., page.tsx, layout.tsx)
components/         # React components
  [Component]/      # Directory-based components with .styles.ts, .types.ts
lib/                # Core business logic (API clients)
docs/               # Technical documentation (EMAIL-CONFIGURATION.md)
public/fonts/       # Local fonts (stanford.woff2)
tailwind/plugins/   # Tailwind customizations (font families)
utilities/          # Helper utilities (datasource color mappings)
vercel.json         # Vercel configuration including cron jobs
```

## Testing & Verification

**Local Testing**:
- Use basic auth credentials: `sws/sws`
- Test API: Check DevTools Network tab for `/api/acquia/*` responses
- Test email: Navigate to `/api/test/email`

**Production Checklist**:
- Verify all environment variables set in Vercel
- Test basic authentication works
- Verify email functionality with test endpoint
- Check Vercel function logs for cron job execution
- Confirm email delivery in Resend dashboard

## Common Pitfalls

1. **Quoted env vars** - `ACQUIA_API_KEY="abc"` breaks auth (remove quotes)
2. **Wrong auth method** - This branch uses basic HTTP auth, not SAML
3. **Date format mismatch** - Frontend sends `YYYY-MM-DD`, API needs ISO 8601
4. **Cache staleness** - 6-hour cache may hide API issues, check timestamps
5. **Decanter overrides** - Don't use arbitrary Tailwind values, use Decanter tokens
6. **Missing email env vars** - `FROM_EMAIL` and `ADMIN_EMAIL` are required for email functionality
7. **CRON_SECRET** - Must be set for email testing and cron job security

## Key Documentation

- **Email Configuration**: `docs/EMAIL-CONFIGURATION.md` (comprehensive email setup guide)
- **Acquia API**: https://cloud.acquia.com/api (official docs, requires login)
- **Decanter**: https://decanter.stanford.edu (Stanford Design System)
- **Next.js 15**: https://nextjs.org/docs (App Router only)
- **Resend**: https://resend.com/docs (email service documentation)

## Branch Strategy
- Main branch: `main` (current development branch)
- Repository: `SU-SWS/churro` (Stanford University Web Services)

---
*Last Updated: Based on codebase analysis, November 2025 - Basic HTTP auth with email reporting*