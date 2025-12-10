# CHURRO - AI Development Guidelines

## Project Overview
**CHURRO** (Cloud Hosting Usage Reporting with Recurring Output) is a Next.js 15 dashboard for visualizing Acquia Cloud hosting analytics (views/visits data). Built for Stanford University with Stanford Design System (Decanter) styling and Stanford SAML SSO integration.

## Architecture

### Tech Stack
- **Framework**: Next.js 15.5+ (App Router only, no Pages Router)
- **Runtime**: Node.js 22.x (enforced via package.json engines)
- **Styling**: TailwindCSS with Decanter preset (Stanford Design System)
- **Authentication**: Stanford SAML SSO via `@node-saml/node-saml`
- **Data Viz**: Recharts for charts/graphs
- **Deployment**: Vercel

### Key Components

**API Routes** (`app/api/`):
- `/api/acquia/applications` - Fetches all Acquia applications
- `/api/acquia/visits` - Fetches visits metrics with pagination
- `/api/acquia/views` - Fetches views metrics with pagination
- `/api/saml/login` - Initiates SAML authentication flow
- `/api/saml/acs` - Assertion Consumer Service for SAML callbacks
- `/api/saml/metadata` - Generates SP metadata XML

**Core Services** (`lib/`):
- `lib/acquia-api.ts` - Acquia Cloud API client with 6-hour caching and pagination
- `lib/saml-config.ts` - SAML configuration with signed requests

**Data Flow**:
1. User selects date range → Dashboard component
2. Dashboard fetches from `/api/acquia/*` routes
3. API routes use `AcquiaApiServiceFixed` with OAuth2 client_credentials flow
4. Response data parsed from Acquia's nested `_embedded.items[].datapoints[]` structure
5. Data cached in-memory for 6 hours with cache keys based on query params

## Development Patterns

### Environment Variables
**Required** (stored in `.env.local`, never committed):
- `ACQUIA_API_KEY` / `ACQUIA_API_SECRET` - OAuth2 credentials (no quotes)
- `NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID` - Subscription identifier
- `NEXT_PUBLIC_ACQUIA_MONTHLY_{VIEWS|VISITS}_ENTITLEMENT` - Usage limits
- `SAML_CERT`, `SAML_SP_CERT`, `SAML_SP_PRIVATE_KEY` - SAML certificates
- `APP_URL` - Base URL (production URL, or inferred from request in dev)
- `SESSION_SECRET` - Session encryption secret (generate with `openssl rand -base64 32`)

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
- `hasDashboardAccess(user)` - Check if can access dashboard (global OR any app)
- `parseAppAccessMappings()` - Parse environment variable mappings

**Middleware Protection** (`middleware.ts`):
- `/` - Dashboard requires global access OR access to ≥1 application
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
- Example: `components/Dashboard.tsx` (line 1)

**Server Components** - Default for:
- Page layouts (`app/layout.tsx`, `app/page.tsx`)
- Static content rendering

**Data Fetching**:
- Client-side: `fetch('/api/acquia/visits')` from Dashboard
- Pass query params: `new URLSearchParams({ subscriptionUuid, from, to })`
- Handle loading states with `CountUpTimer` component

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

**Local Development with HTTPS** (required for SAML):
```bash
nvm use                     # Ensures Node 22.x
npm install                 # Install dependencies

# Set up local HTTPS
brew install mkcert
mkcert -install
mkdir -p .cert
mkcert -key-file .cert/localhost-key.pem -cert-file .cert/localhost-cert.pem localhost 127.0.0.1 ::1

# Configure environment
cp .env.example .env.local  # Create env file
# Edit .env.local:
#   APP_URL=https://localhost:3000
#   SAML_ENTITY_ID=https://churro-test.stanford.edu (if needed)
#   SESSION_SECRET=<generate with: openssl rand -base64 32>

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
  [pages]           # Page components (e.g., page.tsx, layout.tsx)
components/         # React components
  [Component]/      # Directory-based components with .styles.ts, .types.ts
lib/                # Core business logic (API clients, configs)
docs/               # Technical documentation (SAML.md)
public/fonts/       # Local fonts (stanford.woff2)
tailwind/plugins/   # Tailwind customizations (font families)
utilities/          # Helper utilities (datasource color mappings)
```

## Testing & Verification

**Local Testing**:
- Use Stanford UAT environment: `SAML_ENTRY_POINT=https://login-uat.stanford.edu/...`
- Test SAML: Navigate to `/auth/test` page
- Test API: Check DevTools Network tab for `/api/acquia/*` responses

**Production Checklist**:
- Switch to production IdP endpoint (remove `-uat`)
- Update `APP_URL` to production domain
- Verify SPDB registration: https://spdb.stanford.edu
- Check Vercel env vars match `.env.local` structure

## Common Pitfalls

1. **Quoted env vars** - `ACQUIA_API_KEY="abc"` breaks auth (remove quotes)
2. **Wrong SAML cert** - Must match environment (UAT ≠ production cert)
3. **Date format mismatch** - Frontend sends `YYYY-MM-DD`, API needs ISO 8601
4. **Array vs single value** - SAML attributes may be arrays, use `getAttr()` helper
5. **Cache staleness** - 6-hour cache may hide API issues, check timestamps
6. **Decanter overrides** - Don't use arbitrary Tailwind values, use Decanter tokens
7. **User data in URLs** - Never pass sensitive user data in query params; use HTTP-only cookies
8. **Session secret missing** - Ensure `SESSION_SECRET` is set (required for session encryption)

## Key Documentation

- **SAML Setup**: `docs/SAML.md` (comprehensive Stanford SSO guide)
- **Acquia API**: https://cloud.acquia.com/api (official docs, requires login)
- **Decanter**: https://decanter.stanford.edu (Stanford Design System)
- **Next.js 15**: https://nextjs.org/docs (App Router only)

## Branch Strategy
- Main branch: `main` (current development branch)
- Repository: `SU-SWS/churro` (Stanford University Web Services)

---
*Last Updated: Based on codebase analysis, November 2025*
