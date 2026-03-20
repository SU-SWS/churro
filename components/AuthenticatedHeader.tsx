'use client'

import { useState, useEffect } from 'react'
import LogoutButton from '@/components/LogoutButton'
import type { SamlUser } from '@/lib/session-auth'

export default function AuthenticatedHeader() {
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
    <header className="bg-white">
      {/* Stanford Global Identity Bar - Required by brand guidelines */}
      <div className="pl-20 md:pl-30 bg-cardinal-red" style={{ paddingTop: '2px', paddingBottom: '2px' }}>
        <a className="logo hocus:no-underline text-white hocus:text-white leading-none" href="https://www.stanford.edu" style={{ fontSize: '22px' }}>
          Stanford University
        </a>
      </div>

      {/* Local Header */}
      <div className="border-b border-black-20 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-20 sm:px-30 md:px-50 lg:px-30 py-20">
          {/* Logo and Title */}
          <div className="flex items-center mb-15 lg:mb-0">
            <div className="flex items-center">
              <a
                href="/"
                className="logo font-stanford text-cardinal-red type-2 no-underline hover:no-underline focus:no-underline active:no-underline mr-3"
              >
                Stanford
              </a>
              <span className="text-black-60 mx-2 type-1">|</span>
              <a
                href="/"
                className="no-underline hover:no-underline focus:no-underline active:no-underline text-black hover:text-black focus:text-black active:text-black block"
              >
                <div className="rs-p-0">
                  <h1 className="type-3 font-normal mb-0 leading-tight">CHURRO</h1>
                  <p className="type-0 text-black-60 mb-0 leading-tight">Cloud Hosting Usage Reporting with Recurring Output</p>
                </div>
              </a>
            </div>
          </div>

        {/* User Info and Logout */}
        {authenticated && !loading && (
          <div className="flex items-center space-x-15">
            <div className="text-right">
              <p className="type-1 font-semibold text-black mb-2">
                {user?.name || user?.displayName || 'Stanford User'}
              </p>
              <p className="type-0 text-black-60 mb-0">
                {user?.sunetId && `${user.sunetId}@stanford.edu`}
              </p>
            </div>
            <LogoutButton variant="secondary" size="small" />
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center space-x-10">
            <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-cardinal-red"></div>
            <span className="type-0 text-black-60">Loading...</span>
          </div>
        )}
        </div>
      </div>
    </header>
  )
}