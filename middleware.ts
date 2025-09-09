import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import auth from 'basic-auth';

const USERNAME = 'sws';
const PASSWORD = 'sws';

export function middleware(request: NextRequest) {
  // Only protect paths you want (here, all except /_next, /api/public, etc.)
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/favicon.ico')
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

// Optionally, define which paths to match
export const config = {
  matcher: ['/((?!_next|api/public|favicon.ico).*)'],
};