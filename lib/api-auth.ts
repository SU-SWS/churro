import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, hasApplicationAccess, hasGlobalAccess } from '@/lib/auth-utils'

/**
 * Middleware helper for API route authorization
 *
 * This provides authorization checking specifically for API routes.
 * Use this in individual API route handlers where you need to check
 * user permissions before processing the request.
 */

/**
 * Check if the current user is authorized to access API endpoints
 * @param request NextRequest object
 * @param requireGlobalAccess If true, require global access (not just app-specific)
 * @returns Promise<{authorized: boolean, user: SamlUser | null, error?: string}>
 */
export async function checkApiAuthorization(
  request: NextRequest,
  requireGlobalAccess = false
) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return {
        authorized: false,
        user: null,
        error: 'Authentication required'
      }
    }

    if (requireGlobalAccess) {
      const hasGlobal = hasGlobalAccess(user)
      if (!hasGlobal) {
        return {
          authorized: false,
          user,
          error: 'Global access required. Contact administrator for access.'
        }
      }
    }

    return {
      authorized: true,
      user
    }
  } catch (error) {
    return {
      authorized: false,
      user: null,
      error: 'Authorization check failed'
    }
  }
}

/**
 * Check if the current user is authorized to access a specific application via API
 * @param request NextRequest object
 * @param applicationUuid Application UUID to check access for
 * @returns Promise<{authorized: boolean, user: SamlUser | null, error?: string}>
 */
export async function checkApplicationApiAuthorization(
  request: NextRequest,
  applicationUuid: string
) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return {
        authorized: false,
        user: null,
        error: 'Authentication required'
      }
    }

    const hasAccess = hasApplicationAccess(user, applicationUuid)
    if (!hasAccess) {
      return {
        authorized: false,
        user,
        error: `Access denied. You do not have permission to access application ${applicationUuid}.`
      }
    }

    return {
      authorized: true,
      user
    }
  } catch (error) {
    return {
      authorized: false,
      user: null,
      error: 'Authorization check failed'
    }
  }
}

/**
 * Create a standardized unauthorized response
 * @param error Error message
 * @param status HTTP status code (default: 403)
 * @returns NextResponse with error
 */
export function createUnauthorizedResponse(error: string, status = 403) {
  return NextResponse.json(
    {
      error,
      code: status === 401 ? 'AUTHENTICATION_REQUIRED' : 'ACCESS_DENIED'
    },
    { status }
  )
}

/**
 * Wrapper function to protect API routes with authorization
 * Usage:
 *
 * export const GET = withApiAuthorization(async (request, { user }) => {
 *   // Your API logic here, user is guaranteed to be authenticated and authorized
 *   return NextResponse.json({ data: 'authorized data' })
 * }, { requireGlobalAccess: true })
 */
export function withApiAuthorization(
  handler: (request: NextRequest, context: { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }) => Promise<Response>,
  options: { requireGlobalAccess?: boolean; requireApplicationUuid?: boolean } = {}
) {
  return async (request: NextRequest) => {
    // Check if application UUID is required and extract it from URL
    let applicationUuid: string | undefined

    if (options.requireApplicationUuid) {
      const url = new URL(request.url)
      // Try to extract UUID from path segments or query params
      const pathSegments = url.pathname.split('/')
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

      applicationUuid = pathSegments.find(segment => uuidRegex.test(segment)) ||
                      url.searchParams.get('uuid') ||
                      url.searchParams.get('applicationUuid') ||
                      undefined

      if (!applicationUuid) {
        return createUnauthorizedResponse('Application UUID required', 400)
      }
    }

    // Perform authorization check
    const authResult = applicationUuid
      ? await checkApplicationApiAuthorization(request, applicationUuid)
      : await checkApiAuthorization(request, options.requireGlobalAccess)

    if (!authResult.authorized || !authResult.user) {
      const status = authResult.error?.includes('Authentication required') ? 401 : 403
      return createUnauthorizedResponse(authResult.error || 'Access denied', status)
    }

    // Call the actual handler with the authorized user
    return handler(request, { user: authResult.user })
  }
}