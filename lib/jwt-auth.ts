import { SignJWT, jwtVerify } from 'jose'

export interface JWTPayload {
  id: string
  sunetId?: string
  email?: string
  name?: string
  affiliation?: string
  [key: string]: any
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production'
)

const JWT_COOKIE_NAME = 'churro-auth-token'

/**
 * Generate a JWT token from user profile data
 */
export async function generateJWT(profile: JWTPayload): Promise<string> {
  const token = await new SignJWT(profile)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h') // Token expires in 24 hours
    .sign(JWT_SECRET)

  return token
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as JWTPayload
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

/**
 * Get the JWT cookie name
 */
export function getJWTCookieName(): string {
  return JWT_COOKIE_NAME
}

/**
 * Get secure cookie options for production/development
 */
export function getSecureCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24, // 24 hours in seconds
    path: '/',
  }
}
