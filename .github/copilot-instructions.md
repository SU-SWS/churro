# CHURRO - AI Development Guidelines

## Project Overview
**CHURRO** (Cloud Hosting Usage Reporting with Recurring Output) is a Next.js 15 dashboard for visualizing Acquia Cloud hosting analytics (views/visits data). Built for Stanford University with Stanford Design System (Decanter) styling, Stanford SAML SSO integration, hybrid caching system, and daily email reporting.

## Architecture

### Tech Stack
- **Framework**: Next.js 15.5+ (App Router only, no Pages Router)
- **Runtime**: Node.js 22.x (enforced via package.json engines)
- **Styling**: TailwindCSS with Decanter preset (Stanford Design System)
- **Authentication**: Stanford SAML SSO via `@node-saml/node-saml`
- **Data Viz**: Recharts for charts/graphs
- **Email**: Resend.com for daily summary emails
- **Deployment**: Vercel

### Key Components

**API Routes** (`app/api/`):
- `/api/acquia/applications` - Fetches all Acquia applications
- `/api/acquia/visits` - Fetches visits metrics with pagination
- `/api/acquia/views` - Fetches views metrics with pagination
- `/api/cache` - Cache management endpoint (GET/DELETE)
- `/api/email/daily-summary` - Sends daily usage summary emails (cron job)
- `/api/test/email` - Test endpoint for email functionality
- `/api/saml/login` - Initiates SAML authentication flow
- `/api/saml/acs` - Assertion Consumer Service for SAML callbacks
- `/api/saml/metadata` - Generates SP metadata XML

**Core Services** (`lib/`):
- `lib/acquia-api.ts` - Acquia Cloud API client with hybrid caching and pagination
- `lib/cache-hybrid.ts` - Hybrid caching system (file-based local, unstable_cache production)
- `lib/cache.ts` - File-based caching for local development
- `lib/email-service.ts` - Shared email functionality with accessibility and security features
- `lib/saml-config.ts` - SAML configuration with signed requests

**Main Pages**:
- `/` - Dashboard with date filtering and tabbed views (Dashboard component)
- `/applications` - Applications overview table (auto-loading, filtered)
- `/applications/[uuid]` - Individual application detail with daily charts

**Data Flow**:
1. User accesses application → SAML auth via middleware (protected routes only)
2. Dashboard/pages fetch from `/api/acquia/*` routes
3. API routes use `AcquiaApiServiceFixed` with OAuth2 client_credentials flow
4. Response data parsed from Acquia's nested `_embedded.items[].datapoints[]` structure
5. Data cached using hybrid cache system for 5 minutes with deployment-based invalidation

## Development Patterns

### Environment Variables
**Required** (stored in `.env.local`, never committed):
- `ACQUIA_API_KEY` / `ACQUIA_API_SECRET` - OAuth2 credentials (no quotes)
- `ACQUIA_API_BASE_URL` / `ACQUIA_AUTH_BASE_URL` - API endpoints (optional, defaults provided)
- `NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID` - Subscription identifier
- `NEXT_PUBLIC_ACQUIA_MONTHLY_{VIEWS|VISITS}_ENTITLEMENT` - Usage limits
- `SAML_CERT`, `SAML_SP_CERT`, `SAML_SP_PRIVATE_KEY` - SAML certificates
- `APP_URL` - Base URL (production URL, or inferred from request in dev)
- `SESSION_SECRET` - Session encryption secret (generate with `openssl rand -base64 32`)

**Email Reporting** (optional, for daily summary emails):
- `RESEND_API_KEY` - Resend.com API key for email delivery
- `FROM_EMAIL` - Sender email address (use onboarding@resend.dev for testing)
- `ADMIN_EMAIL` - Recipient email for daily summaries
- `CRON_SECRET` - Protects cron endpoint from unauthorized access

**Critical**: Values must NOT have surrounding quotes. API key/secret are auto-stripped of quotes in `acquia-api.ts` (lines 91-92).
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
- Credentials auto-cleaned of quotes
- **Debug tip**: Check lines 127-142 for auth method attempts

**Data Parsing** (`lib/acquia-api.ts` lines 312-466):
- Response structure: `_embedded.items[]` where each item = one application
- Each item has `metadata.application.uuids[0]` + `datapoints[]` array
- Datapoints format: `["2025-04-15T00:00:00+00:00", "1124"]` (date, value)
- **Critical**: ONE item = ONE application, ALL datapoints belong to that app

**Caching**:
- Hybrid cache system: file-based (local) vs unstable_cache (production)
- 5-minute cache duration with deployment-based invalidation
- Cache keys based on deployment ID for automatic invalidation
- Browser cache prevention via `cache: 'reload'` and unique timestamps
- Cache keys: `generateCacheKey([endpoint, uuid, from, to, resolution])`
- Cache hit returns immediately without API call

**Date Filtering** (lines 218-262):
- API expects ISO 8601: `2025-04-15T23:59:59.000Z`
- Frontend sends: `YYYY-MM-DD` (conditional - only if user sets dates)
- Conversion adds `T00:00:00.000Z` (start) or `T23:59:59.000Z` (end)
- Filter format: `filter=from=2025-04-01T00:00:00.000Z,to=2025-04-30T23:59:59.000Z`
- No default date filtering (fetches all available data)

### Hybrid Caching System

**Local Development** (`lib/cache.ts`):
- File-based caching in `.cache/` directory
- 5-minute TTL with file timestamps
- Persists across server restarts
- Manual clearing via file deletion

**Production** (`lib/cache-hybrid.ts`):
- Next.js `unstable_cache` with deployment versioning
- Cache keys include `VERCEL_DEPLOYMENT_ID` for auto-invalidation
- Application-layer timestamp validation (5 minutes)
- Browser cache prevention via headers and unique URLs

**Key Features**:
- Environment detection at runtime
- Deployment-based cache invalidation
- Cross-instance cache sharing on Vercel
- Manual cache clearing via `/api/cache` DELETE endpoint

### SAML Authentication

**Flow** (detailed in `docs/SAML.md`):
1. User clicks "Sign In with Stanford SAML" → `/api/saml/login`
2. `saml.getAuthorizeUrlAsync()` generates signed AuthnRequest
3. Redirect to Stanford IdP (`login-uat.stanford.edu` or `login.stanford.edu`)
4. Stanford returns signed+encrypted assertion to `/api/saml/acs`
5. `saml.validatePostResponseAsync()` verifies signature and decrypts
6. Extract attributes via OID mappings (e.g., `urn:oid:0.9.2342.19200300.100.1.1` = SUNet ID)
7. Generate JWT token from user profile using `jose` library (`lib/jwt-auth.ts`)
8. Set JWT in HTTP-only cookie (`churro-auth-token`) with 24-hour expiration
9. Redirect to application (no user data in URL params - security best practice)

**JWT Cookie Authentication** (`lib/session-auth.ts`):
- Uses `iron-session` library for encrypted session management with better security than signed JWTs
- Secret from `SESSION_SECRET` environment variable (required, no default)
- Cookie options: `httpOnly: true`, `secure: true` (production), `sameSite: 'lax'`
- Token expires in 24 hours
- Helper functions: `createSession()`, `verifySession()`, `getSessionCookieName()`

**Middleware Protection** (`middleware.ts`):
- Checks JWT cookie on protected routes (e.g., `/protected/*`)
- Verifies token validity and redirects to `/api/saml/login` if invalid
- Adds user info to request headers (`x-user-id`, `x-user-sunetid`, `x-user-email`)
- Non-protected routes pass through without checks

**Client-Side Auth Checking**:
- Use `/api/auth/status` to check authentication (reads HTTP-only cookie server-side)
- Returns `{ authenticated: boolean, user: {...} }`
- Use `/api/auth/logout` to clear JWT cookie
- Never pass user data in URL params - security risk!

**Attribute Parsing** (`app/api/saml/acs/route.ts` lines 27-34):
```typescript
const getAttr = (key: string): string | undefined => {
  const value = attributes[key]
  if (Array.isArray(value)) return value[0] as string
  return value as string | undefined
}
```
**Always handle arrays** - Stanford may send single values or arrays.

**Security**:
- Private key (`SAML_SP_PRIVATE_KEY`) signs requests and decrypts assertions
- Public cert (`SAML_SP_CERT`) verified by Stanford IdP
- JWT tokens stored in HTTP-only cookies (not accessible to JavaScript)
- Clock skew: 5 minutes (`acceptedClockSkewMs: 300000`)

### Authorization System

**Two-Tier Access Control**:
1. **Global Access**: Users with specific `eduPersonEntitlement` values access everything
2. **Per-Application Access**: SUNet ID mappings grant access to specific applications

**Environment Variables**:
- `CHURRO_GLOBAL_ENTITLEMENTS` - Comma-separated list (e.g., `uit:sws,stanford:faculty`)
- `CHURRO_APP_ACCESS` - UUID:uid mappings (e.g., `uuid1:jdoe,jsmith;uuid2:jdoe`)

**Key Components** (`lib/auth-utils.ts`):
- `hasGlobalAccess(user)` - Check if user has global entitlement
- `hasApplicationAccess(user, uuid)` - Check specific app access
- `hasDashboardAccess(user)` - Check if can access dashboard (global access only)
- `parseAppAccessMappings()` - Parse environment variable mappings

**Middleware Protection** (`middleware.ts`):
- `/` - Dashboard requires global access only
- `/applications/[uuid]` - Requires global access OR specific application access
- Returns 403 with clear error messages for unauthorized access

**API Protection** (`lib/api-auth.ts`):
```typescript
export async function GET(request: NextRequest) {
  return withApiAuthorization(async (request: NextRequest, context: { user: SamlUser }) => {
    // Protected API logic with user context
    return NextResponse.json({ data: 'protected' });
  })(request);
}
```

**Client-Side Handling**:
- Authorization errors (403) display user-friendly error pages
- Client components check API response status and handle authorization failures
- Provides contact information and "Return to Dashboard" links

**Authorization Flow**:
1. User authenticates via Stanford SAML
2. Middleware checks global entitlements first
3. If no global access, checks per-application mappings
4. Routes/APIs enforce access before rendering/processing
5. Clear error messages for authorization failures

### Component Patterns

**Client Components** - Use `'use client'` directive when:
- Using React hooks (`useState`, `useEffect`)
- Browser APIs (localStorage, fetch)
- Timer components (`CountUpTimer`)
- Example: `components/Dashboard.tsx` (line 1)

**Server Components** - Default for:
- Page layouts (`app/layout.tsx`, `app/page.tsx`)
- Static content rendering

**Data Fetching**:
- Client-side: `fetch('/api/acquia/visits')` with cache-busting timestamps
- Pass query params: `new URLSearchParams({ subscriptionUuid, from, to })`
- Handle loading states with `CountUpTimer` component

## Page Architecture

### Dashboard (`/`)
- **Purpose**: Main analytics dashboard with date filtering
- **Features**:
  - User-configurable date range inputs
  - Subscription UUID input field
  - Tabbed interface (pie charts, bar charts, data tables)
  - Manual "Fetch Analytics Data" button
  - Cache clearing functionality
- **Data**: Fetches all apps, views, and visits with optional date filtering

### Applications Page (`/applications`)
- **Purpose**: Overview table of all applications with statistics
- **Features**:
  - Auto-loads on page mount (no manual refresh needed)
  - Shows current Pacific time timestamp
  - Displays views/visits totals and percentages
  - Links to individual application pages
  - Excludes specific UUIDs: `2b2d2517-3839-414e-85a4-7183adc22283`, `1ef402a7-c301-42d7-9b63-f226fa1b2329`
- **Data**: Fetches all available data (no date filtering)
- **Styling**: Stanford Design System table with alternating rows

### Application Detail (`/applications/[uuid]`)
- **Purpose**: Individual application analytics with daily resolution
- **Features**:
  - Date range picker for custom filtering
  - Daily resolution charts (line charts)
  - Application name resolution from UUID
  - Cache clearing functionality
- **Data**: Fetches daily data with `resolution=day` parameter

## Email Reporting System

**Daily Summary Emails** (`app/api/email/daily-summary/`):
- **Trigger**: Vercel cron job runs daily at 9 AM UTC (configured in `vercel.json`)
- **Data**: Aggregates views/visits across all applications for current month with data lag handling
- **Data Lag Protection**: Uses 2-day offset when possible, but never crosses month boundaries:
  - Day 1: Current day only (no previous data)
  - Day 2: First day only (avoids previous month)
  - Day 3: First day only (2-day offset would be previous month)
  - Day 4+: 2-day offset within current month
## Common Tasks

### Adding a New Chart Type
1. Create component in `components/` (e.g., `NewChart.tsx`)
2. Import Recharts primitives: `{ BarChart, Bar, XAxis, YAxis, Tooltip }`
3. Accept `data` prop with `{ name: string, value: number, uuid: string }[]`
4. Use Decanter colors: `className='fill-cardinal-red'`
5. Add tab to `Dashboard.tsx` TABS array
6. Add conditional render in tab content section

### Debugging Acquia API Issues
1. Check API route error responses for detailed error info including envCheck
2. Check auth: Uncomment console.logs in `lib/acquia-api.ts` lines 95-141
3. Verify auth credentials are set correctly (no quotes)
4. Verify date parsing: Check logs at lines 237-251 (date formatting)
5. Inspect response structure: Logs at lines 320-330 (parsing entry point)
6. Monitor cache behavior via console logs
7. Cache debugging: Search for "Returning cached" logs
8. Use "Clear Cache" functionality to force fresh data

### Environment Setup

**Local Development with HTTPS** (required for SAML):
```bash
nvm use                     # Ensures Node 22.x
npm install                 # Install dependencies

# Set up local HTTPS (required for SAML)
brew install mkcert
mkcert -install
mkdir -p .cert
mkcert -key-file .cert/localhost-key.pem -cert-file .cert/localhost-cert.pem localhost 127.0.0.1 ::1

# Configure environment
cp .env.example .env.local  # Create env file
# Edit .env.local:
#   ACQUIA_API_KEY=your-api-key
#   ACQUIA_API_SECRET=your-api-secret
#   NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID=your-subscription-uuid
#   NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT=your-views-limit
#   NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT=your-visits-limit
#   APP_URL=https://localhost:3000
#   SAML_ENTITY_ID=https://churro-test.stanford.edu (if needed)
#   SESSION_SECRET=<generate with: openssl rand -base64 32>
#   RESEND_API_KEY=your-resend-key (optional)
#   FROM_EMAIL=onboarding@resend.dev (optional)
#   ADMIN_EMAIL=your-email@stanford.edu (optional)
#   CRON_SECRET=generate-with-openssl-rand-base64-32 (optional)

# Start development server
npm run dev:https           # HTTPS server (required for SAML)
# OR
npm run dev                 # HTTP server (basic development, no SAML)
```

**SAML Entity ID Configuration**:
- `APP_URL` - Where your app runs (e.g., `https://localhost:3000`)
- `SAML_ENTITY_ID` - (Optional) What Stanford expects (e.g., `https://churro-test.stanford.edu`)
- If `SAML_ENTITY_ID` is not set, it defaults to `APP_URL`
- Use `SAML_ENTITY_ID` for local dev when SPDB registration differs from local URL

### Adding New Application Exclusions
1. Edit the `EXCLUDED_UUIDS` array in `/app/applications/page.tsx`
2. Add UUID string to the array
3. Applications will be filtered from both table display and statistics

### Cache Management
1. **Local**: Cache stored in `.cache/` directory (gitignored)
2. **Production**: Cache cleared automatically on deployment
3. **Manual**: Use "Clear Cache" buttons in UI or `DELETE /api/cache`
4. **TTL**: 5 minutes across all environments

### Setting Up Email Reporting
1. **Get Resend API Key**: Sign up at [resend.com](https://resend.com)
2. **Configure Environment Variables**:
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxx
   FROM_EMAIL=onboarding@resend.dev  # For testing
   ADMIN_EMAIL=your-email@stanford.edu
   CRON_SECRET=your-secure-random-key
   ```
3. **Test Email**: Visit `/api/test/email` in browser or use curl
4. **Deploy**: Cron job automatically runs daily at 9 AM UTC
5. **Production**: Verify your own domain in Resend or work with Stanford IT for @stanford.edu addresses

### Modifying Email Schedule
1. Edit `vercel.json` cron schedule
2. Common patterns:
   - `"0 9 * * *"` - 9 AM UTC daily
   - `"0 17 * * *"` - 5 PM UTC daily (9 AM PST)
   - `"0 8 * * 1-5"` - 8 AM UTC, weekdays only

### Adding New SAML Attributes
1. Find OID from Stanford docs: https://uit.stanford.edu/service/authentication/saml
2. Add to `user` object in `app/api/saml/acs/route.ts` (lines 36-71)
3. Use `getAttr()` helper to handle arrays
4. Example: `newAttr: getAttr('urn:oid:x.x.x.x.x')`
5. User data is automatically included in JWT token payload

### Protecting Routes with Authentication
1. Add route pattern to middleware matcher if needed
2. Check for protected path prefix in `middleware.ts` (default: `/protected/*`)
3. Middleware automatically redirects unauthenticated users to `/api/saml/login`
4. Access user info in API routes via request headers: `x-user-id`, `x-user-sunetid`, `x-user-email`

### Checking Auth Status Client-Side
```typescript
// Check if user is authenticated
const response = await fetch('/api/auth/status')
const { authenticated, user } = await response.json()

// Logout
window.location.href = '/api/auth/logout'
```

## File Organization

```
app/
  api/              # API routes (Next.js 15 route handlers)
    acquia/         # Acquia Cloud API proxy routes
    cache/          # Cache management endpoint
    email/          # Email functionality
      daily-summary/ # Daily summary cron job
    saml/           # SAML authentication endpoints
      login/        # SAML login initiation
      acs/          # Assertion Consumer Service
      metadata/     # SP metadata generation
    test/           # Testing endpoints
      email/        # Email testing
  applications/     # Applications pages
    [uuid]/         # Individual application detail
    page.tsx        # Applications overview table
  page.tsx          # Home page (Dashboard component)
  layout.tsx        # Root layout with Stanford fonts
components/         # React components
  Dashboard.tsx     # Main dashboard with tabs and charts
  CountUpTimer.tsx  # Loading timer component
  [Charts]/         # Recharts-based chart components
  [Component]/      # Directory-based components with .styles.ts, .types.ts
  [UI]/             # Stanford Design System components
lib/                # Core business logic
  acquia-api.ts     # Acquia API client with OAuth2 and hybrid caching
  cache-hybrid.ts   # Hybrid caching system
  cache.ts          # File-based cache (local development)
  email-service.ts  # Shared email functionality with accessibility and security
  saml-config.ts    # SAML configuration with signed requests
  jwt-auth.ts       # JWT token generation and verification
  session-auth.ts   # Session management with iron-session
docs/               # Documentation
  caching.md        # Comprehensive caching system docs
  EMAIL-CONFIGURATION.md # Email setup guide
  SAML.md           # Comprehensive Stanford SSO guide
public/fonts/       # Local fonts (stanford.woff2)
tailwind/plugins/   # Tailwind customizations (font families)
utilities/          # Helper utilities (datasource color mappings)
middleware.ts       # SAML authentication middleware
vercel.json         # Vercel configuration including cron jobs
```

## Testing & Verification

**Local Testing**:
- Use Stanford UAT environment: `SAML_ENTRY_POINT=https://login-uat.stanford.edu/...`
- Test SAML authentication flow via login page
- Test API endpoints directly via browser DevTools
- Test API: Check DevTools Network tab for `/api/acquia/*` responses
- Test email: Navigate to `/api/test/email`
- Check cache behavior via console logs
- Check API error responses for envCheck debugging info

**Production Checklist**:
- Switch to production IdP endpoint (remove `-uat`)
- Update `APP_URL` to production domain
- Verify SPDB registration: https://spdb.stanford.edu
- Verify all environment variables set in Vercel
- Test SAML authentication works
- Confirm caching behavior (5-minute TTL)
- Check that excluded applications don't appear in `/applications`
- Verify email functionality with test endpoint
- Test cron endpoint with manual CRON_SECRET if needed
- Check Vercel function logs for cron job execution
- Confirm email delivery in Resend dashboard

## Common Pitfalls

1. **Quoted env vars** - `ACQUIA_API_KEY="abc"` breaks auth (remove quotes)
2. **Wrong SAML cert** - Must match environment (UAT ≠ production cert)
3. **Date format mismatch** - Frontend sends `YYYY-MM-DD`, API needs ISO 8601
4. **Array vs single value** - SAML attributes may be arrays, use `getAttr()` helper
5. **Cache staleness** - 5-minute cache may hide API issues, use cache clearing
6. **Decanter overrides** - Don't use arbitrary Tailwind values, use Decanter tokens
7. **User data in URLs** - Never pass sensitive user data in query params; use HTTP-only cookies
8. **Session secret missing** - Ensure `SESSION_SECRET` is set (required for session encryption)
9. **Application filtering** - Remember to add UUIDs to exclusion list when needed
10. **Missing email env vars** - `FROM_EMAIL` and `ADMIN_EMAIL` are required for email functionality
11. **CRON_SECRET confusion** - Test endpoint doesn't need it; cron endpoint does for manual calls
12. **Security oversights** - Always escape HTML output, validate environment variables at startup
13. **Accessibility issues** - Use proper semantic HTML, ARIA labels, and table structure in emails

## Dependencies

**Core Dependencies**:
- `next` ^15.5.2 - Next.js framework
- `react` 18.3.1 - React library
- `axios` ^1.12.0 - HTTP client for API calls
- `recharts` ^2.12.7 - Chart components
- `decanter` ^7.4.0 - Stanford Design System
- `@node-saml/node-saml` ^5.1.0 - SAML SSO authentication
- `iron-session` ^8.0.4 - Session management
- `node-forge` ^1.3.1 - Cryptographic functions
- `basic-auth` ^2.0.1 - Basic authentication utilities

**Development Dependencies**:
- `typescript` ^5.5.2 - TypeScript support
- `tailwindcss` ^3.4.17 - Utility-first CSS
- `eslint` ^8.57.0 - Code linting

## Key Documentation

- **SAML Setup**: `docs/SAML.md` (comprehensive Stanford SSO guide)
- **Caching System**: `docs/caching.md` (comprehensive caching guide)
- **Email Configuration**: `docs/EMAIL-CONFIGURATION.md` (comprehensive email setup guide)
- **Acquia API**: https://cloud.acquia.com/api (official docs, requires login)
- **Acquia API Rate Limits**: https://docs.acquia.com/acquia-cloud-platform/developing-cloud-platform-api (rate limiting information)
- **Decanter**: https://decanter.stanford.edu (Stanford Design System)
- **Next.js 15**: https://nextjs.org/docs (App Router only)
- **Resend**: https://resend.com/docs (email service documentation)

## Branch Strategy
- Current branch: `2.x-integration` (integration of caching + email + SAML features)
- Repository: `SU-SWS/churro` (Stanford University Web Services)

---
*Last Updated: December 2025 - Integration branch with SAML SSO, hybrid caching, and email reporting*
