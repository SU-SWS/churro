'use client'
import { useState, useEffect } from "react"
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import LogoutButton from '@/components/LogoutButton'

// The actual test component
function AuthTestContent() {
  const [user, setUser] = useState<any>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const searchParams = useSearchParams()

  // Check authentication status on mount and after SAML callback
  useEffect(() => {
    checkAuth()
  }, [searchParams])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/status')
      if (response.ok) {
        const data = await response.json()
        setAuthenticated(data.authenticated)
        setUser(data.user)

        // Check if this is a SAML callback
        const samlSuccess = searchParams.get('saml_success')
        if (samlSuccess) {
          setMessage('✅ SAML Authentication Successful!')
        }
      } else {
        setAuthenticated(false)
        setUser(null)

        // Check for SAML errors
        const samlError = searchParams.get('saml_error')
        if (samlError) {
          setMessage(`❌ SAML Error: ${samlError}`)
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
      setAuthenticated(false)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSamlLogin = () => {
    window.location.href = '/api/saml/login'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-50">
        <div className="max-w-4xl mx-auto px-20">
          <h1 className="type-2 text-center mb-30">🔐 SAML Authentication Test</h1>
          <div className="text-center text-18">
            <div className="animate-spin rounded-full h-30 w-30 border-b-2 border-cardinal-red mx-auto mb-15"></div>
            Loading authentication status...
          </div>
        </div>
      </div>
    )
  }

  if (authenticated && user) {
    return (
      <div className="min-h-screen bg-gray-50 py-50">
        <div className="max-w-4xl mx-auto px-20">
          <div className="bg-white shadow-lg rounded-lg p-30">
            {/* Header with logout button */}
            <div className="flex justify-between items-start mb-30">
              <h1 className="type-2 text-digital-green">✅ Authentication SUCCESS</h1>
              <LogoutButton variant="secondary" />
            </div>

            {/* Success message */}
            {message && (
              <div className="bg-digital-green-light border border-digital-green text-digital-green-dark px-20 py-15 rounded-lg mb-30">
                <p className="text-16 font-semibold">{message}</p>
              </div>
            )}

            {/* User data display */}
            <div className="mb-30">
              <h2 className="type-3 mb-15">User Profile:</h2>
              <div className="bg-black-10 p-20 rounded-lg overflow-auto">
                <pre className="text-14 text-gc-black whitespace-pre-wrap">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </div>
            </div>

            {/* Info panel */}
            <div className="bg-digital-blue-light border border-digital-blue rounded-lg p-20">
              <h3 className="type-4 text-digital-blue-dark mb-10">ℹ️ Session Information</h3>
              <div className="text-16 space-y-5">
                <p>• Your session is stored in a secure HTTP-only encrypted cookie</p>
                <p>• Session data is validated by middleware on each request</p>
                <p>• Session expires in 24 hours from login</p>
                <p>• All authentication is handled server-side for security</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-50">
      <div className="max-w-2xl mx-auto px-20">
        <div className="bg-white shadow-lg rounded-lg p-30 text-center">
          <h1 className="type-2 mb-30">🔐 SAML Authentication Test</h1>

          {/* Error/Success messages */}
          {message && (
            <div className={`px-20 py-15 rounded-lg mb-30 ${
              message.includes('❌')
                ? 'bg-cardinal-red-light border border-cardinal-red text-cardinal-red-dark'
                : 'bg-digital-green-light border border-digital-green text-digital-green-dark'
            }`}>
              <p className="text-16 font-semibold">{message}</p>
            </div>
          )}

          {/* Login button */}
          <button
            onClick={handleSamlLogin}
            className="inline-flex items-center justify-center bg-cardinal-red text-white px-30 py-15 text-18 font-semibold rounded-lg transition-colors duration-200 hocus:bg-black hocus:text-white focus:outline-none focus:ring-2 focus:ring-cardinal-red focus:ring-offset-2 mb-30"
            type="button"
          >
            🎓 Sign In with Stanford SAML
          </button>

          {/* Debug info */}
          <div className="bg-black-10 rounded-lg p-20 text-left">
            <h3 className="type-4 mb-15">Development Tools:</h3>
            <div className="space-y-8 text-16">
              <div>
                <h4 className="font-semibold mb-5">Test Links:</h4>
                <ul className="space-y-3 ml-15">
                  <li>
                    <a
                      href="/api/saml/login"
                      className="text-cardinal-red hocus:text-black hocus:underline"
                    >
                      Direct SAML Login
                    </a>
                  </li>
                  <li>
                    <a
                      href="/api/saml/metadata"
                      className="text-cardinal-red hocus:text-black hocus:underline"
                    >
                      SP Metadata XML
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Loading component
function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 py-50">
      <div className="max-w-2xl mx-auto px-20 text-center">
        <h1 className="type-2 mb-30">🔐 SAML Authentication Test</h1>
        <div className="animate-spin rounded-full h-30 w-30 border-b-2 border-cardinal-red mx-auto mb-15"></div>
        <div className="text-18">Loading...</div>
      </div>
    </div>
  )
}

// Main component with Suspense wrapper
export default function AuthTestPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AuthTestContent />
    </Suspense>
  )
}