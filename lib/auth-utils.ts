import { getSessionCookieName, type SamlUser } from '@/lib/session-auth'

// Cache the parsed app access mappings to avoid re-parsing on every request
let cachedAppAccessMappings: Map<string, Set<string>> | null = null

// Cache the parsed global entitlements to avoid re-parsing on every request
let cachedGlobalEntitlements: Set<string> | null = null

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
 * Cached at module level for performance
 */
export function parseAppAccessMappings(): Map<string, Set<string>> {
  // Return cached result if available
  if (cachedAppAccessMappings !== null) {
    return cachedAppAccessMappings
  }

  const mappings = new Map<string, Set<string>>()
  const envVar = process.env.CHURRO_APP_ACCESS

  if (!envVar) {
    cachedAppAccessMappings = mappings
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

  // Cache the result
  cachedAppAccessMappings = mappings
  return mappings
}

/**
 * Parse global entitlements from environment variable
 * Cached at module level for performance
 */
function parseGlobalEntitlements(): Set<string> {
  // Return cached result if available
  if (cachedGlobalEntitlements !== null) {
    return cachedGlobalEntitlements
  }

  const globalEntitlements = process.env.CHURRO_GLOBAL_ENTITLEMENTS
  const entitlements = new Set<string>()

  if (globalEntitlements) {
    globalEntitlements.split(',').forEach(e => entitlements.add(e.trim()))
  }

  // Cache the result
  cachedGlobalEntitlements = entitlements
  return entitlements
}

/**
 * Check if user has global access via eduPersonEntitlement
 */
export function hasGlobalAccess(user: SamlUser): boolean {
  if (!user.eduPersonEntitlement) {
    return false
  }

  const allowedEntitlements = parseGlobalEntitlements()
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
