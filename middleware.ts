import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Just pass everything through - no authentication
  return NextResponse.next();
}

export const config = {
  // Still exclude static assets and API routes from middleware processing
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};