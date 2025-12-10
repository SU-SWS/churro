import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, getSessionCookieName } from '@/lib/session-auth';

/**
 * Middleware for JWT authentication
 *
 * DESIGN DECISION: Authentication (AuthN) vs Authorization (AuthZ)
 *
 * This middleware currently implements AUTHENTICATION ONLY:
 * - Verifies user identity via JWT tokens from SAML SSO
 * - Protects routes with the /protected/* prefix
 * - Adds user identity headers for authenticated requests
 *
 * API routes (/api/*) are intentionally NOT protected because:
 * 1. This branch implements AuthN only - AuthZ is future work
 * 2. API routes currently return all data for a given subscription UUID
 * 3. There's no user-data association or permission filtering yet
 * 4. Main application routes (/, /applications/*) are also public
 *
 * FUTURE AuthZ work should:
 * - Associate users with specific applications/data they can access
 * - Filter API responses based on user permissions
 * - Implement role-based access control (RBAC)
 * - Then protect API routes to enforce these permissions
 */
export async function middleware(request: NextRequest) {
  // For protected routes, check authentication
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/protected');

  if (isProtectedRoute) {
    // Verify the session
    const payload = await verifySession();
    if (!payload) {
      // Invalid session, redirect to SAML login
      return NextResponse.redirect(new URL('/api/saml/login', request.url));
    }

    // Token is valid, add user info to request headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.id);
    if (payload.sunetId) {
      requestHeaders.set('x-user-sunetid', payload.sunetId);
    }
    if (payload.email) {
      requestHeaders.set('x-user-email', payload.email);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // For non-protected routes, just pass through
  return NextResponse.next();
}

export const config = {
  /**
   * Middleware matcher configuration
   *
   * Excludes from middleware processing:
   * - _next: Next.js internal routes (static files, build assets)
   * - api: API routes (intentionally public - see comment above)
   * - favicon.ico: Browser favicon requests
   *
   * Protected routes must use the /protected/* prefix to require authentication.
   * Example: /protected/admin, /protected/dashboard
   */
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};