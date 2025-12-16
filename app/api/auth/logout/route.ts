import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSessionCookieName } from '@/lib/session-auth'
import { getBaseUrl } from '@/lib/url-utils'

/**
 * Logout route - clears the JWT cookie
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const { searchParams } = new URL(request.url)

  // Delete the JWT cookie
  cookieStore.delete(getSessionCookieName())

  // Check if redirect URL is specified (e.g., from test page)
  const redirectTo = searchParams.get('redirectTo')
  const baseUrl = getBaseUrl(request)

  if (redirectTo) {
    // Validate that redirect is to a safe path (starts with /)
    if (redirectTo.startsWith('/')) {
      return NextResponse.redirect(new URL(redirectTo, baseUrl))
    }
  }

  // Default redirect to home page
  return NextResponse.redirect(new URL('/', baseUrl))
}
