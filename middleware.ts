import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT, getJWTCookieName } from '@/lib/jwt-auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(getJWTCookieName())?.value;

  // For protected routes, check authentication
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/protected');

  if (isProtectedRoute) {
    if (!token) {
      // No token, redirect to SAML login
      return NextResponse.redirect(new URL('/api/saml/login', request.url));
    }

    // Verify the JWT token
    const payload = await verifyJWT(token);
    if (!payload) {
      // Invalid token, redirect to SAML login
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
  // Exclude static assets and API routes from middleware processing
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};