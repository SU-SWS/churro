import { getJWTCookieName, type SamlUser } from '@/lib/jwt-auth'

/**
 * Authorization utilities for CHURRO application
 *
 * Implements two-tier access control:
 * 1. Global access via eduPersonEntitlement (e.g., 'uit:sws')
 * 2. Per-application access via uid mappings
 */

/**
 * Get authorized eduPersonEntitlement values from environment variables
 * Format: CHURRO_GLOBAL_ENTITLEMENTS=uit:sws,other:entitlement
 */
export function getAuthorizedEntitlements(): string[] {
  const entitlements = process.env.CHURRO_GLOBAL_ENTITLEMENTS
  if (!entitlements) {
    return []
  }

  return entitlements
    .split(',')
    .map(e => e.trim())
    .filter(e => e.length > 0)
}

/**
 * Parse per-application UID mappings from environment variables
 * Format: CHURRO_APP_ACCESS=uuid1:uid1,uid2;uuid2:uid3,uid4
 * Returns Map<applicationUuid, Set<authorizedUids>>
 */
export function parseAppAccessMappings(): Map<string, Set<string>> {
  const mappings = new Map<string, Set<string>>()
  const accessString = process.env.CHURRO_APP_ACCESS

  if (!accessString) {
    return mappings
  }

  try {
    // Split by semicolon to get app mappings: "uuid1:uid1,uid2;uuid2:uid3,uid4"
    const appMappings = accessString.split(';')

    for (const mapping of appMappings) {
      const [appUuid, uidsString] = mapping.split(':')

      if (appUuid && uidsString) {
        const uids = uidsString
          .split(',')
          .map(uid => uid.trim())
          .filter(uid => uid.length > 0)

        mappings.set(appUuid.trim(), new Set(uids))
      }
    }
  } catch (error) {
    console.warn('Failed to parse CHURRO_APP_ACCESS environment variable:', error)
  }

  return mappings
}

/**
 * Check if user has global access to the application
 * @param user SAML user object
 * @returns true if user has global access via eduPersonEntitlement
 */
export function hasGlobalAccess(user: SamlUser): boolean {
  const authorizedEntitlements = getAuthorizedEntitlements()

  if (authorizedEntitlements.length === 0) {
    // No global entitlements configured - deny access
    return false
  }

  if (!user.eduPersonEntitlement) {
    // User has no entitlements
    return false
  }

  // User may have multiple entitlements, check if any match
  const userEntitlements = Array.isArray(user.eduPersonEntitlement)
    ? user.eduPersonEntitlement
    : [user.eduPersonEntitlement]

  return userEntitlements.some(entitlement =>
    authorizedEntitlements.includes(entitlement)
  )
}/**
 * Check if user has access to a specific application
 * @param user SAML user object
 * @param applicationUuid Application UUID to check access for
 * @returns true if user has access (either global or per-app)
 */
export function hasApplicationAccess(user: SamlUser, applicationUuid: string): boolean {
  // First check global access
  if (hasGlobalAccess(user)) {
    return true
  }

  // Check per-application access
  const appMappings = parseAppAccessMappings()
  const authorizedUids = appMappings.get(applicationUuid)

  if (!authorizedUids || authorizedUids.size === 0) {
    // No specific access configured for this app
    return false
  }

  if (!user.sunetId) {
    // User has no SUNet ID
    return false
  }

  return authorizedUids.has(user.sunetId)
}

/**
 * Check if user can access the main dashboard
 * Dashboard access requires global access only - per-app users should go directly to their apps
 * @param user SAML user object
 * @returns true if user can access dashboard (global access only)
 */
export function hasDashboardAccess(user: SamlUser): boolean {
  // Only users with global access can see the dashboard
  return hasGlobalAccess(user)
}/**
 * Get list of application UUIDs the user has access to
 * @param user SAML user object
 * @returns Array of application UUIDs user can access (empty array = all apps for global users)
 */
export function getUserApplicationAccess(user: SamlUser): string[] {
  // Global access grants access to all apps
  if (hasGlobalAccess(user)) {
    return [] // Empty array means "all apps" for global users
  }

  if (!user.sunetId) {
    return []
  }

  const appMappings = parseAppAccessMappings()
  const accessibleApps: string[] = []

  appMappings.forEach((authorizedUids, appUuid) => {
    if (authorizedUids.has(user.sunetId!)) {
      accessibleApps.push(appUuid);
    }
  });

  return accessibleApps
}

/**
 * Authorization debugging helper
 * @param user SAML user object
 * @returns Object with authorization details for debugging
 */
export function getAuthorizationDebugInfo(user: SamlUser) {
  return {
    userId: user.sunetId || user.id,
    userEntitlements: user.eduPersonEntitlement,
    hasGlobalAccess: hasGlobalAccess(user),
    hasDashboardAccess: hasDashboardAccess(user),
    accessibleApps: getUserApplicationAccess(user),
    configuredEntitlements: getAuthorizedEntitlements(),
    configuredAppMappings: Object.fromEntries(parseAppAccessMappings())
  }
}

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
