import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getJWTCookieName } from '@/lib/jwt-auth'

/**
 * Logout route - clears the JWT cookie
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()

  // Delete the JWT cookie
  cookieStore.delete(getJWTCookieName())

  // Redirect to home page or login page
  const baseUrl = process.env.NEXTAUTH_URL || 'https://churro-test.stanford.edu'
  return NextResponse.redirect(new URL('/', baseUrl))
}

export async function POST(request: NextRequest) {
  return GET(request)
}
