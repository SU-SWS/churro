/**
 * Get the base URL for the application
 *
 * Priority:
 * 1. APP_URL environment variable (explicit, production/staging)
 * 2. VERCEL_BRANCH_URL (stable per-branch URL injected by Vercel on branch deploys)
 * 3. VERCEL_URL (per-deployment URL injected by Vercel)
 * 4. Infer from request URL (local development)
 * 5. Throw error if none available
 *
 * @param request - Optional NextRequest to infer URL from
 * @returns The base URL (without trailing slash)
 * @throws Error if URL cannot be determined
 */
export function getBaseUrl(request?: Request): string {
  // First try explicit environment variable
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '')
  }

  // Vercel injects these automatically on every deployment (no protocol prefix)
  if (process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // Fallback: infer from request (local development)
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