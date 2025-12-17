'use client'

import { useState } from 'react'

interface LogoutButtonProps {
  redirectTo?: string
  variant?: 'primary' | 'secondary' | 'text'
  size?: 'small' | 'medium'
  className?: string
}

export default function LogoutButton({
  redirectTo = '/auth/test',
  variant = 'secondary',
  size = 'medium',
  className = ''
}: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      // Use the logout API route with optional redirect
      const logoutUrl = new URL('/api/auth/logout', window.location.origin)
      if (redirectTo) {
        logoutUrl.searchParams.set('redirectTo', redirectTo)
      }
      window.location.href = logoutUrl.toString()
    } catch (error) {
      console.error('Logout failed:', error)
      setIsLoading(false)
    }
  }

  // Base classes using Decanter design tokens
  const baseClasses = 'inline-flex items-center justify-center font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 hocus:no-underline'

  // Variant styles
  const variantClasses = {
    primary: 'bg-cardinal-red text-white hocus:bg-black hocus:text-white focus:ring-cardinal-red',
    secondary: 'border border-black text-black bg-transparent hocus:bg-black hocus:text-white focus:ring-black',
    text: 'text-cardinal-red hocus:text-black hocus:underline focus:ring-cardinal-red'
  }

  // Size styles
  const sizeClasses = {
    small: 'px-15 py-8 text-16',
    medium: 'px-20 py-10 text-18'
  }

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className={classes}
      type="button"
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-8 h-16 w-16" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Signing out...
        </>
      ) : (
        'Sign Out'
      )}
    </button>
  )
}