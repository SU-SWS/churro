/**
 * Get the base URL for the application.
 *
 * Priority:
 * 1. APP_URL — explicit override, always wins
 * 2. VERCEL_PROJECT_PRODUCTION_URL — Vercel injects the custom domain (e.g. churro.stanford.edu)
 *    on ALL environments, but gated to Production only here to prevent Preview deploys from
 *    resolving to the production domain and breaking Preview SAML URLs.
 * 3. VERCEL_BRANCH_URL — stable per-branch URL (always *.vercel.app); Preview only.
 * 4. VERCEL_URL — per-deployment URL (always *.vercel.app); Preview only.
 * 5. Infer from request URL (local development).
 * 6. Throw if none available.
 *
 * VERCEL_BRANCH_URL and VERCEL_URL are intentionally excluded on Production because they
 * are always *.vercel.app URLs and won't match a custom domain's SAML registration.
 *
 * @param request - Optional Request to infer URL from in local development
 * @returns The base URL (without trailing slash)
 * @throws Error if URL cannot be determined
 */
export function getBaseUrl(request?: Request): string {
  // First try explicit environment variable
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '')
  }

  const isVercelProduction = process.env.VERCEL_ENV === 'production'

  // VERCEL_PROJECT_PRODUCTION_URL holds the custom domain (e.g. churro.stanford.edu).
  // Vercel injects it on all environments, so gate it to Production only — on Preview
  // it would resolve to the production domain and break Preview SAML URLs.
  if (isVercelProduction && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/$/, '')
  }

  // VERCEL_BRANCH_URL / VERCEL_URL are *.vercel.app — only useful for Preview deploys
  if (!isVercelProduction) {
    if (process.env.VERCEL_BRANCH_URL) {
      return `https://${process.env.VERCEL_BRANCH_URL}`.replace(/\/$/, '')
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '')
    }
  }

  // Fallback: infer from request (local development)
  if (request) {
    const url = new URL(request.url)
    return `${url.protocol}//${url.host}`
  }

  throw new Error(
    isVercelProduction
      ? 'APP_URL must be set for Vercel Production deployments (VERCEL_PROJECT_PRODUCTION_URL can also serve as a fallback if your custom domain is configured in Vercel).'
      : 'APP_URL environment variable is not set. Set APP_URL in your .env.local file.'
  )
}