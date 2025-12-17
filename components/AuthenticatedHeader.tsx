'use client'

import { useState, useEffect } from 'react'
import LogoutButton from '@/components/LogoutButton'
import type { SamlUser } from '@/lib/session-auth'

interface AuthenticatedHeaderProps {
  title: string
}

export default function AuthenticatedHeader({ title }: AuthenticatedHeaderProps) {
  const [user, setUser] = useState<SamlUser | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status')
      if (response.ok) {
        const data = await response.json()
        setAuthenticated(data.authenticated)
        setUser(data.user)
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <header className="bg-white border-b border-black-20">
      {/* Stanford Header Bar */}
      <div className="px-20 sm:px-30 md:px-50 lg:px-30 pt-5 pb-1 bg-cardinal-red">
        <a className="logo hocus:no-underline text-white hocus:text-white text-20 leading-none" href="https://www.stanford.edu">
          Stanford University
        </a>
      </div>

      {/* Main Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-20 sm:px-30 md:px-50 lg:px-30 py-20">
        {/* Logo and Title */}
        <div className="flex items-center mb-15 lg:mb-0">
          <div className="rs-p-0">
            <a
              href="/"
              className="logo text-cardinal-red type-3 no-underline hover:no-underline focus:no-underline active:no-underline"
              aria-label="Go to CHURRO homepage"
            >
              <span className="block">
                Stanford <br/> University
              </span>
            </a>
          </div>

          <div className="ml-4">
            <a
              href="/"
              className="no-underline hover:no-underline focus:no-underline active:no-underline text-black hover:text-black focus:text-black active:text-black block"
              aria-label="Go to CHURRO homepage"
            >
              <h1 className="text-4xl rs-p-0 whitespace-nowrap">{title}</h1>
            </a>
          </div>
        </div>

        {/* User Info and Logout */}
        {authenticated && !loading && (
          <div className="flex items-center space-x-15">
            <div className="text-right mr-15">
              <p className="text-16 font-semibold text-black mb-0">
                {user?.name || user?.displayName || 'Stanford User'}
              </p>
              <p className="text-14 text-black-60 mb-0">
                {user?.sunetId && `${user.sunetId}@stanford.edu`}
              </p>
            </div>
            <LogoutButton variant="secondary" size="small" />
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center space-x-10">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cardinal-red"></div>
            <span className="text-14 text-black-60">Loading...</span>
          </div>
        )}
      </div>
    </header>
  )
}