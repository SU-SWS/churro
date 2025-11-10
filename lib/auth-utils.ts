import { getJWTCookieName, type SamlUser } from '@/lib/jwt-auth'

/**
 * Get the current authenticated user from cookies (server-side)
 * For use in Server Components and API routes
 */
export async function getCurrentUser(): Promise<SamlUser | null> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const token = cookieStore.get(getJWTCookieName())?.value

  if (!token) {
    return null
  }

  // In server components, we can decode the JWT
  const { verifyJWT } = await import('@/lib/jwt-auth')
  const payload = await verifyJWT(token)

  return payload
}

/**
 * Client-side hook to check authentication status
 * Since cookies are HTTP-only, client can only check if they're logged in
 * via an API route that reads the cookie
 */
export async function checkAuthStatus(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/status')
    if (response.ok) {
      const data = await response.json()
      return data.authenticated === true
    }
    return false
  } catch {
    return false
  }
}
