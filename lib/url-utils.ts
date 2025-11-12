/**
 * Get the base URL for the application
 *
 * Priority:
 * 1. APP_URL environment variable (production/staging)
 * 2. Infer from request URL (local development)
 * 3. Throw error if neither available
 *
 * @param request - Optional NextRequest to infer URL from
 * @returns The base URL (without trailing slash)
 * @throws Error if URL cannot be determined
 */
export function getBaseUrl(request?: Request): string {
  // First try environment variable (should always be set in production)
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '') // Remove trailing slash
  }

  // Fallback: Try to infer from request (local development)
  if (request) {
    const url = new URL(request.url)
    return `${url.protocol}//${url.host}`
  }

  // If we get here, configuration is missing
  throw new Error(
    'APP_URL environment variable is not set. ' +
    'This is required for authentication redirects. ' +
    'Please set APP_URL in your .env.local file.'
  )
}