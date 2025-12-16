import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, getSessionCookieName } from '@/lib/session-auth'

/**
 * API route to check authentication status and return user info
 * This is safe for client-side use since the session is HTTP-only
 */
export async function GET(request: NextRequest) {
  const payload = await verifySession()

  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  // Return the full user payload from session
  // Note: Data in the session should all be known to the user, thus safe to return upon authentication
  return NextResponse.json({
    authenticated: true,
    user: payload,
  })
}
