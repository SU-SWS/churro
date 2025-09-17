'use client'
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

// The actual test component
function AuthTestContent() {
  const { data: session, status } = useSession()
  const [samlUser, setSamlUser] = useState(null)
  const [message, setMessage] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check for SAML callback results
    const samlSuccess = searchParams.get('saml_success')
    const samlError = searchParams.get('saml_error')
    const userData = searchParams.get('user')

    if (samlSuccess && userData) {
      try {
        const user = JSON.parse(userData)
        setSamlUser(user)
        setMessage('✅ SAML Authentication Successful!')
      } catch (e) {
        setMessage('❌ Error parsing user data')
      }
    } else if (samlError) {
      setMessage(`❌ SAML Error: ${samlError}`)
    }
  }, [searchParams])

  const handleSamlLogin = () => {
    console.log('🚀 Starting SAML login...')
    window.location.href = '/api/saml/login'
  }

  const user = session?.user || samlUser

  if (user) {
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
          onClick={() => {
            if (session) {
              signOut({ callbackUrl: '/auth/test' })
            } else {
              setSamlUser(null)
              setMessage('')
              window.history.replaceState({}, '', '/auth/test')
            }
          }}
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