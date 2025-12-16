import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Validate authentication configuration at startup - fail fast if misconfigured
const USERNAME = process.env.BASIC_AUTH_USERNAME;
const PASSWORD = process.env.BASIC_AUTH_PASSWORD;

// Startup validation - log configuration issues immediately
if (!USERNAME || !PASSWORD) {
  console.error('❌ CRITICAL: BASIC_AUTH_USERNAME or BASIC_AUTH_PASSWORD environment variables not configured');
  console.error('❌ Application will be inaccessible to external users until authentication is properly configured');
}

const isAuthConfigured = !!(USERNAME && PASSWORD);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and public API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/api/email/daily-summary' // Allow Vercel cron job
  ) {
    return NextResponse.next();
  }

  // Allow requests from localhost (IPv4 and IPv6) for development
  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '';
  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('::ffff:127.0.0.1')
  ) {
    return NextResponse.next();
  }

  // If authentication is not configured, return generic service unavailable
  // without revealing configuration details
  if (!isAuthConfigured) {
    return new NextResponse('Service temporarily unavailable', {
      status: 503,
      headers: {
        'Retry-After': '300', // Suggest retry after 5 minutes
      },
    });
  }

  // Get the Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  // Parse credentials
  const credentials = Buffer.from(authHeader.split(' ')[1] || '', 'base64').toString().split(':');
  const [user, pass] = credentials;

  if (user === USERNAME && pass === PASSWORD) {
    return NextResponse.next();
  }

  return new NextResponse('Access denied', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

export const config = {
  matcher: ['/((?!_next|api/public|api/email/daily-summary|favicon.ico).*)'],
};