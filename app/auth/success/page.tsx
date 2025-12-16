'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AuthSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Get the return URL from query parameters
    const returnTo = searchParams.get('returnTo') || '/'

    // Small delay to ensure session cookie is available
    const timer = setTimeout(() => {
      console.log('✅ Authentication successful, redirecting to:', returnTo)
      router.replace(returnTo)
    }, 100) // 100ms delay to ensure session is ready

    return () => clearTimeout(timer)
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cardinal-red mx-auto"></div>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">
          Authentication Successful
        </h2>
        <p className="mt-2 text-gray-600">
          Redirecting you to your requested page...
        </p>
      </div>
    </div>
  )
}