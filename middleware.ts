import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT, getJWTCookieName } from '@/lib/jwt-auth';
import { hasDashboardAccess, hasApplicationAccess } from '@/lib/auth-utils';

/**
 * Middleware for JWT authentication and authorization
 *
 * IMPLEMENTATION: Authentication (AuthN) + Authorization (AuthZ)
 *
 * This middleware implements both AUTHENTICATION and AUTHORIZATION:
 * - Verifies user identity via JWT tokens from SAML SSO
 * - Enforces authorization rules based on eduPersonEntitlement and uid mappings
 * - Protects application routes and dashboard based on user permissions
 *
 * Authorization Rules:
 * 1. Global Access: Users with configured eduPersonEntitlement (e.g., 'uit:sws')
 *    can access everything
 * 2. Per-App Access: Individual uid mappings grant access to specific applications
 * 3. Dashboard Access: Granted only to users with global access
 *    (per-app users should go directly to their authorized applications)
 *
 * API routes (/api/*) are intentionally NOT protected in middleware because:
 * - API-level authorization is implemented in individual route handlers
 * - This allows for more granular permission checking with request context
 * - Different APIs may have different authorization requirements
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(getJWTCookieName())?.value;
  const pathname = request.nextUrl.pathname;

  // Check if this is a protected route that requires authentication
  const isProtectedRoute = pathname.startsWith('/protected');

  // Check if this is an application detail page that requires authorization
  const isApplicationRoute = pathname.match(/^\/applications\/([a-f0-9-]{36})$/);

  // Check if this is the dashboard that requires authorization
  const isDashboardRoute = pathname === '/' || pathname.startsWith('/dashboard');

  // Exclude auth test pages from all protection
  const isAuthTestRoute = pathname.startsWith('/auth/');

  // For routes requiring authentication/authorization (excluding auth test routes)
  if (!isAuthTestRoute && (isProtectedRoute || isApplicationRoute || isDashboardRoute)) {
    if (!token) {
      // No token, redirect to SAML login
      return NextResponse.redirect(new URL('/api/saml/login', request.url));
    }

    // Verify the JWT token
    const user = await verifyJWT(token);
    if (!user) {
      // Invalid token, redirect to SAML login
      return NextResponse.redirect(new URL('/api/saml/login', request.url));
    }

    // Authorization checks
    if (isApplicationRoute) {
      const appUuid = isApplicationRoute[1];
      if (!hasApplicationAccess(user, appUuid)) {
        // User doesn't have access to this specific application
        return NextResponse.json(
          { error: 'Access denied. You do not have permission to view this application.' },
          { status: 403 }
        );
      }
    } else if (isDashboardRoute) {
      if (!hasDashboardAccess(user)) {
        // User doesn't have access to dashboard
        return NextResponse.json(
          { error: 'Access denied. You do not have permission to access this application.' },
          { status: 403 }
        );
      }
    }

    // Token is valid and user is authorized, add user info to request headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id);
    if (user.sunetId) {
      requestHeaders.set('x-user-sunetid', user.sunetId);
    }
    if (user.email) {
      requestHeaders.set('x-user-email', user.email);
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
   * - api: API routes (have individual authorization in route handlers)
   * - favicon.ico: Browser favicon requests
   *
   * Protected routes:
   * - /protected/*: Always require authentication
   * - /applications/[uuid]: Require app-specific authorization
   * - / (dashboard): Require dashboard authorization
   *
   * Public routes that bypass middleware:
   * - /auth/*: Authentication flows (login, test pages)
   */
  matcher: ['/((?!_next|api|favicon.ico|auth).*)'],
};