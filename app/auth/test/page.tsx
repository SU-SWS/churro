'use client'
import { useState, useEffect } from "react"
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

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

  const handleLogout = () => {
    window.location.href = '/api/auth/logout'
  }

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>🔐 SAML Authentication Test</h1>
        <div>Loading authentication status...</div>
      </div>
    )
  }

  if (authenticated && user) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>✅ Authentication SUCCESS</h1>

        {message && (
          <div style={{ background: '#d4edda', padding: '10px', marginBottom: '20px', borderRadius: '4px' }}>
            {message}
          </div>
        )}

        <h2>User Data:</h2>
        <pre style={{ background: '#f4f4f4', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(user, null, 2)}
        </pre>

        <button
          onClick={handleLogout}
          style={{
            background: '#dc3545',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>

        <div style={{ marginTop: '20px', background: '#e7f3ff', padding: '15px', borderRadius: '4px' }}>
          <h3>ℹ️ Authentication Info:</h3>
          <p>Your session is stored in a secure HTTP-only cookie and validated by the middleware.</p>
          <p>Token expires in 24 hours from login.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>🔐 SAML Authentication Test</h1>

      {message && (
        <div style={{
          background: message.includes('❌') ? '#f8d7da' : '#d4edda',
          padding: '10px',
          marginBottom: '20px',
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}

      <button
        onClick={handleSamlLogin}
        style={{
          background: '#007bff',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        🎓 Sign In with Stanford SAML
      </button>

      <div style={{ marginTop: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '4px' }}>
        <h3>Debug Info:</h3>

        <h4>Test Links:</h4>
        <ul>
          <li><a href="/api/saml/login">Direct SAML Login</a></li>
          <li><a href="/api/saml/metadata">SP Metadata</a></li>
        </ul>
      </div>
    </div>
  )
}

// Loading component
function Loading() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>🔐 SAML Authentication Test</h1>
      <div>Loading...</div>
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