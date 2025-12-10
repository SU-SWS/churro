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
 * Parse application access mappings from environment variable
 * Format: uuid1:uid1,uid2;uuid2:uid3,uid4
 */
export function parseAppAccessMappings(): Map<string, Set<string>> {
  const mappings = new Map<string, Set<string>>()
  const envVar = process.env.CHURRO_APP_ACCESS

  if (!envVar) {
    return mappings
  }

  // Split by semicolon to get each app mapping
  const appMappings = envVar.split(';')

  for (const appMapping of appMappings) {
    const [uuid, uidsStr] = appMapping.split(':')
    if (uuid && uidsStr) {
      const uids = new Set(uidsStr.split(',').map(uid => uid.trim()))
      mappings.set(uuid.trim(), uids)
    }
  }

  return mappings
}

/**
 * Check if user has global access via eduPersonEntitlement
 */
export function hasGlobalAccess(user: SamlUser): boolean {
  const globalEntitlements = process.env.CHURRO_GLOBAL_ENTITLEMENTS
  if (!globalEntitlements || !user.eduPersonEntitlement) {
    return false
  }

  const allowedEntitlements = new Set(globalEntitlements.split(',').map(e => e.trim()))
  return allowedEntitlements.has(user.eduPersonEntitlement)
}

/**
 * Check if user has access to a specific application
 */
export function hasApplicationAccess(user: SamlUser, appUuid: string): boolean {
  // Global access users can access everything
  if (hasGlobalAccess(user)) {
    return true
  }

  // Check per-application access
  const appMappings = parseAppAccessMappings()
  const allowedUsers = appMappings.get(appUuid)

  if (!allowedUsers || !user.sunetId) {
    return false
  }

  return allowedUsers.has(user.sunetId)
}

/**
 * Check if user can access the dashboard
 * Dashboard access requires global access (not per-app access)
 */
export function hasDashboardAccess(user: SamlUser): boolean {
  return hasGlobalAccess(user)
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
