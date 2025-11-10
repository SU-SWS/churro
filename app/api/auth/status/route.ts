import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT, getJWTCookieName } from '@/lib/jwt-auth'

/**
 * API route to check authentication status and return user info
 * This is safe for client-side use since the JWT is HTTP-only
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(getJWTCookieName())?.value

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const payload = await verifyJWT(token)

  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  // Return sanitized user info (exclude sensitive fields if any)
  return NextResponse.json({
    authenticated: true,
    user: {
      id: payload.id,
      sunetId: payload.sunetId,
      email: payload.email,
      name: payload.name,
      affiliation: payload.affiliation,
      displayName: payload.displayName,
    },
  })
}
