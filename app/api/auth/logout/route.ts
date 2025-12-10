import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getJWTCookieName } from '@/lib/jwt-auth'
import { getBaseUrl } from '@/lib/url-utils'

/**
 * Logout route - clears the JWT cookie
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()

  // Delete the JWT cookie
  cookieStore.delete(getJWTCookieName())

  // Redirect to home page or login page
  const baseUrl = getBaseUrl(request)
  return NextResponse.redirect(new URL('/', baseUrl))
}
