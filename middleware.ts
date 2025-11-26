import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const USERNAME = process.env.BASIC_AUTH_USERNAME;
const PASSWORD = process.env.BASIC_AUTH_PASSWORD;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and public API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  // Allow requests from localhost (IPv4 and IPv6)
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
  matcher: ['/((?!_next|api/public|favicon.ico).*)'],
};