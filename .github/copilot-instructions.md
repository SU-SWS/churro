# CHURRO - AI Development Guidelines

## Project Overview
**CHURRO** (Cloud Hosting Usage Reporting with Recurring Output) is a Next.js 15 dashboard for visualizing Acquia Cloud hosting analytics (views/visits data). Built for Stanford University with Stanford Design System (Decanter) styling and basic HTTP authentication.

## Architecture

### Tech Stack
- **Framework**: Next.js 15.5+ (App Router only, no Pages Router)
- **Runtime**: Node.js 22.x (enforced via package.json engines)
- **Styling**: TailwindCSS with Decanter preset (Stanford Design System)
- **Authentication**: Basic HTTP Authentication via middleware
- **Data Viz**: Recharts for charts/graphs
- **Deployment**: Vercel

### Key Components

**API Routes** (`app/api/`):
- `/api/acquia/applications` - Fetches all Acquia applications
- `/api/acquia/visits` - Fetches visits metrics with pagination
- `/api/acquia/views` - Fetches views metrics with pagination
- `/api/cache` - Cache management endpoint (GET/DELETE)

**Core Services** (`lib/`):
- `lib/acquia-api.ts` - Acquia Cloud API client with hybrid caching and pagination
- `lib/cache-hybrid.ts` - Hybrid caching system (file-based local, unstable_cache production)
- `lib/cache.ts` - File-based caching for local development

**Main Pages**:
- `/` - Dashboard with date filtering and tabbed views (Dashboard component)
- `/applications` - Applications overview table (auto-loading, filtered)
- `/applications/[uuid]` - Individual application detail with daily charts

**Data Flow**:
1. User accesses application → Basic auth via middleware
2. Dashboard/pages fetch from `/api/acquia/*` routes
3. API routes use `AcquiaApiServiceFixed` with OAuth2 client_credentials flow
4. Response data parsed from Acquia's nested `_embedded.items[].datapoints[]` structure
5. Data cached using hybrid cache system for 5 minutes

## Development Patterns

### Environment Variables
**Required** (stored in `.env.local`, never committed):
- `ACQUIA_API_KEY` / `ACQUIA_API_SECRET` - OAuth2 credentials (no quotes)
- `NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID` - Subscription identifier
- `NEXT_PUBLIC_ACQUIA_MONTHLY_{VIEWS|VISITS}_ENTITLEMENT` - Usage limits
- `ACQUIA_API_BASE_URL` - API base URL (defaults to https://cloud.acquia.com/api)
- `ACQUIA_AUTH_BASE_URL` - Auth base URL (defaults to https://accounts.acquia.com/api)

**Critical**: Values must NOT have surrounding quotes. API key/secret are auto-stripped of quotes in `acquia-api.ts`.

### Authentication

**Basic HTTP Authentication** (`middleware.ts`):
- Username: `sws`
- Password: `sws`
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

**Authentication** (`lib/acquia-api.ts`):
- OAuth2 client credentials flow with 3 fallback methods
- Token cached in `this.accessToken`, auto-retries on 401
- Credentials auto-cleaned of quotes

**Data Parsing**:
- Response structure: `_embedded.items[]` where each item = one application
- Each item has `metadata.application.uuids[0]` + `datapoints[]` array
- Datapoints format: `["2025-04-15T00:00:00+00:00", "1124"]` (date, value)
- **Critical**: ONE item = ONE application, ALL datapoints belong to that app

**Caching**:
- Hybrid cache system: file-based (local) vs unstable_cache (production)
- 5-minute cache duration with deployment-based invalidation
- Cache keys based on deployment ID for automatic invalidation
- Browser cache prevention via `cache: 'reload'` and unique timestamps

**Date Filtering**:
- API expects ISO 8601: `2025-04-15T23:59:59.000Z`
- Frontend sends: `YYYY-MM-DD` (conditional - only if user sets dates)
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

### Component Patterns

**Client Components** - Use `'use client'` directive when:
- Using React hooks (`useState`, `useEffect`)
- Browser APIs (localStorage, fetch)
- Timer components (`CountUpTimer`)

**Server Components** - Default for:
- Page layouts (`app/layout.tsx`)
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

## Common Tasks

### Adding a New Chart Type
1. Create component in `components/` (e.g., `NewChart.tsx`)
2. Import Recharts primitives: `{ BarChart, Bar, XAxis, YAxis, Tooltip }`
3. Accept `data` prop with `{ name: string, value: number, uuid: string }[]`
4. Use Decanter colors: `className='fill-cardinal-red'`
5. Add tab to Dashboard TABS array
6. Add conditional render in tab content section

### Debugging Acquia API Issues
1. Check API route error responses for detailed error info including envCheck
2. Verify auth credentials are set correctly (no quotes)
3. Monitor cache behavior via console logs
4. Use "Clear Cache" functionality to force fresh data

### Environment Setup

**Local Development**:
```bash
nvm use                     # Ensures Node 22.x
npm install                 # Install dependencies

# Configure environment
cp .env.example .env.local  # Create env file if needed
# Edit .env.local with required Acquia credentials

npm run dev                 # Start development server
```

### Adding New Application Exclusions
1. Edit the `EXCLUDED_UUIDS` array in `/app/applications/page.tsx`
2. Add UUID string to the array
3. Applications will be filtered from both table display and statistics

### Cache Management
1. **Local**: Cache stored in `.cache/` directory (gitignored)
2. **Production**: Cache cleared automatically on deployment
3. **Manual**: Use "Clear Cache" buttons in UI or `DELETE /api/cache`
4. **TTL**: 5 minutes across all environments

## File Organization

```
app/
  api/              # API routes (Next.js 15 route handlers)
    acquia/         # Acquia Cloud API proxy routes
    cache/          # Cache management endpoint
  applications/     # Applications pages
    [uuid]/         # Individual application detail
    page.tsx        # Applications overview table
  page.tsx          # Home page (Dashboard component)
  layout.tsx        # Root layout with Stanford fonts
components/         # React components
  Dashboard.tsx     # Main dashboard with tabs and charts
  CountUpTimer.tsx  # Loading timer component
  [Charts]/         # Recharts-based chart components
  [UI]/             # Stanford Design System components
lib/                # Core business logic
  acquia-api.ts     # Acquia API client with OAuth2 and caching
  cache-hybrid.ts   # Hybrid caching system
  cache.ts          # File-based cache (local development)
docs/               # Documentation
  caching.md        # Comprehensive caching system docs
middleware.ts       # Basic HTTP authentication
utilities/          # Helper utilities
```

## Testing & Verification

**Local Testing**:
- Use basic auth credentials: sws/sws
- Test API endpoints directly via browser DevTools
- Check cache behavior via console logs
- Check API error responses for envCheck debugging info

**Production Checklist**:
- Verify all environment variables set in Vercel
- Test basic authentication works
- Confirm caching behavior (5-minute TTL)
- Check that excluded applications don't appear in `/applications`

## Common Pitfalls

1. **Quoted env vars** - `ACQUIA_API_KEY="abc"` breaks auth (remove quotes)
2. **Wrong auth method** - This branch uses basic HTTP auth, not SAML
3. **Date format mismatch** - Frontend sends `YYYY-MM-DD`, API needs ISO 8601
4. **Cache staleness** - 5-minute cache may hide API issues, use cache clearing
5. **Decanter overrides** - Don't use arbitrary Tailwind values, use Decanter tokens
6. **Application filtering** - Remember to add UUIDs to exclusion list when needed

## Dependencies

**Core Dependencies**:
- `next` ^15.5.2 - Next.js framework
- `react` 18.3.1 - React library
- `axios` ^1.12.0 - HTTP client for API calls
- `recharts` ^2.12.7 - Chart components
- `decanter` ^7.4.0 - Stanford Design System
- `basic-auth` ^2.0.1 - Basic authentication utilities

**Development Dependencies**:
- `typescript` ^5.5.2 - TypeScript support
- `tailwindcss` ^3.4.17 - Utility-first CSS
- `eslint` ^8.57.0 - Code linting

## Key Documentation

- **Caching System**: `docs/caching.md` (comprehensive caching guide)
- **Acquia API**: https://cloud.acquia.com/api (official docs, requires login)
- **Acquia API Rate Limits**: https://docs.acquia.com/acquia-cloud-platform/developing-cloud-platform-api (rate limiting information)
- **Decanter**: https://decanter.stanford.edu (Stanford Design System)
- **Next.js 15**: https://nextjs.org/docs (App Router only)

## Branch Strategy
- Current branch: `ACHOO-119-20251015`
- Repository: `SU-SWS/churro` (Stanford University Web Services)

---
*Last Updated: November 2025 - Reflects current implementation with basic HTTP auth and hybrid caching*
