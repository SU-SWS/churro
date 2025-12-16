import { getSessionCookieName, type SamlUser } from '@/lib/session-auth'

/**
 * Get the current authenticated user from session (server-side)
 * For use in Server Components and API routes
 */
export async function getCurrentUser(): Promise<SamlUser | null> {
  // In server components, we can verify the session
  const { verifySession } = await import('@/lib/session-auth')
  const payload = await verifySession()

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
