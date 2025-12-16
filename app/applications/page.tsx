'use client'

import React, { useEffect, useState } from 'react'
import { Container } from '@/components/Container'
import type { ApplicationData } from '@/lib/acquia-api'

// UUIDs to exclude from the display
const EXCLUDED_UUIDS = [
  '2b2d2517-3839-414e-85a4-7183adc22283',
  '1ef402a7-c301-42d7-9b63-f226fa1b2329'
]

export default function ApplicationsPage() {
  const [applicationsData, setApplicationsData] = useState<ApplicationData[]>([])
  const [totalViews, setTotalViews] = useState<number>(0)
  const [totalVisits, setTotalVisits] = useState<number>(0)
  const [viewsEntitlement, setViewsEntitlement] = useState<number>(0)
  const [visitsEntitlement, setVisitsEntitlement] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<string>('')

  useEffect(() => {
    // Get entitlements from environment
    const monthlyViewsEntitlement = process.env.NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT
    const monthlyVisitsEntitlement = process.env.NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT

    setViewsEntitlement(monthlyViewsEntitlement ? parseInt(monthlyViewsEntitlement, 10) : 0)
    setVisitsEntitlement(monthlyVisitsEntitlement ? parseInt(monthlyVisitsEntitlement, 10) : 0)

    // Set current time on component mount and update it periodically
    const updateTime = () => {
      const now = new Date()
      const pacificTime = now.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      setCurrentTime(pacificTime)
    }

    updateTime()
    const timeInterval = setInterval(updateTime, 1000)

    // Auto-fetch data on component mount
    fetchApplicationsData()

    return () => clearInterval(timeInterval)
  }, [])

  const fetchApplicationsData = async () => {
    try {
      setLoading(true)
      setError(null)

      const subscriptionUuid = process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID
      if (!subscriptionUuid) {
        throw new Error('Missing subscription UUID')
      }

      console.log('🚀 Fetching data for subscription:', subscriptionUuid)

      // Add unique timestamp to prevent caching
      const timestamp = Date.now()

      // Fetch all data in parallel
      const [appsResponse, viewsResponse, visitsResponse] = await Promise.all([
        fetch(`/api/acquia/applications?subscriptionUuid=${subscriptionUuid}&timestamp=${timestamp}`, { cache: 'reload' }),
        fetch(`/api/acquia/views?subscriptionUuid=${subscriptionUuid}&timestamp=${timestamp}`, { cache: 'reload' }),
        fetch(`/api/acquia/visits?subscriptionUuid=${subscriptionUuid}&timestamp=${timestamp}`, { cache: 'reload' })
      ])

      if (!appsResponse.ok || !viewsResponse.ok || !visitsResponse.ok) {
        console.error('API responses:', {
          apps: appsResponse.status,
          views: viewsResponse.status,
          visits: visitsResponse.status
        })
        throw new Error('Failed to fetch some data')
      }

      const [applications, views, visits] = await Promise.all([
        appsResponse.json(),
        viewsResponse.json(),
        visitsResponse.json()
      ])

      console.log('📊 Raw data:', { applications: applications.length, views: views.length, visits: visits.length })

      // Filter out excluded applications
      const filteredApplications = applications.filter((app: any) => !EXCLUDED_UUIDS.includes(app.uuid))
      const filteredViews = views.filter((view: any) => !EXCLUDED_UUIDS.includes(view.uuid))
      const filteredVisits = visits.filter((visit: any) => !EXCLUDED_UUIDS.includes(visit.uuid))

      console.log('📊 Filtered data:', { applications: filteredApplications.length, views: filteredViews.length, visits: filteredVisits.length })

      // Calculate totals for the filtered data
      const viewsTotal = filteredViews.reduce((sum: number, app: any) => sum + app.value, 0)
      const visitsTotal = filteredVisits.reduce((sum: number, app: any) => sum + app.value, 0)

      console.log('📊 Totals:', { views: viewsTotal, visits: visitsTotal })

      // Create a combined dataset
      const combinedData: ApplicationData[] = filteredApplications.map((app: any) => {
        const appViews = filteredViews.find((v: any) => v.uuid === app.uuid)
        const appVisits = filteredVisits.find((v: any) => v.uuid === app.uuid)

        return {
          uuid: app.uuid,
          name: app.name,
          hostname: app.hostname || '',
          views: appViews?.value || 0,
          visits: appVisits?.value || 0,
          viewsPercentage: viewsTotal > 0 ? ((appViews?.value || 0) / viewsTotal * 100) : 0,
          visitsPercentage: visitsTotal > 0 ? ((appVisits?.value || 0) / visitsTotal * 100) : 0
        }
      })

      // Sort by views descending
      combinedData.sort((a, b) => b.views - a.views)

      setApplicationsData(combinedData)
      setTotalViews(viewsTotal)
      setTotalVisits(visitsTotal)

      console.log('✅ Data processing completed!')

    } catch (err) {
      console.error('❌ Error fetching applications data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const viewsPercentage = viewsEntitlement > 0 ? (totalViews / viewsEntitlement * 100) : 0
  const visitsPercentage = visitsEntitlement > 0 ? (totalVisits / visitsEntitlement * 100) : 0

  if (loading) {
    return (
      <Container>
        <div className="py-20">
          <h1 className="type-2 mb-10">Applications Overview</h1>
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cardinal-red"></div>
            <p className="mt-5">Loading applications data...</p>
          </div>
        </div>
      </Container>
    )
  }

  if (error) {
    return (
      <Container>
        <div className="py-20">
          <h1 className="type-2 mb-10">Applications Overview</h1>
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-5 rounded">
            <p><strong>Error:</strong> {error}</p>
            <button
              onClick={fetchApplicationsData}
              className="mt-5 bg-cardinal-red text-white px-5 py-2 rounded hocus:bg-cardinal-red-dark"
            >
              Try Again
            </button>
          </div>
        </div>
      </Container>
    )
  }

  return (
    <Container>
      <div className="py-20">
        <div className="mb-10">
          <h1 className="type-2 mb-5">Applications Overview</h1>
          <div className="text-sm text-black-80 mb-5">
            Current Pacific Time: <span className="font-mono">{currentTime}</span>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <div className="bg-white border border-black-20 p-8 rounded-lg">
              <h2 className="type-3 mb-3 text-cardinal-red">Total Views</h2>
              <div className="type-0 font-bold mb-2">{totalViews.toLocaleString()}</div>
              {viewsEntitlement > 0 && (
                <>
                  <div className="text-sm text-black-80">
                    {viewsPercentage.toFixed(1)}% of {viewsEntitlement.toLocaleString()} monthly entitlement
                  </div>
                  <div className="mt-3 w-full bg-black-20 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${viewsPercentage > 90 ? 'bg-red-600' : viewsPercentage > 75 ? 'bg-yellow-500' : 'bg-digital-green'}`}
                      style={{ width: `${Math.min(viewsPercentage, 100)}%` }}
                    ></div>
                  </div>
                </>
              )}
            </div>

            <div className="bg-white border border-black-20 p-8 rounded-lg">
              <h2 className="type-3 mb-3 text-cardinal-red">Total Visits</h2>
              <div className="type-0 font-bold mb-2">{totalVisits.toLocaleString()}</div>
              {visitsEntitlement > 0 && (
                <>
                  <div className="text-sm text-black-80">
                    {visitsPercentage.toFixed(1)}% of {visitsEntitlement.toLocaleString()} monthly entitlement
                  </div>
                  <div className="mt-3 w-full bg-black-20 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${visitsPercentage > 90 ? 'bg-red-600' : visitsPercentage > 75 ? 'bg-yellow-500' : 'bg-digital-green'}`}
                      style={{ width: `${Math.min(visitsPercentage, 100)}%` }}
                    ></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Applications Table */}
        <div className="bg-white border border-black-20 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-black-10">
              <tr>
                <th className="px-8 py-5 text-left type-3 font-semibold">Application</th>
                <th className="px-8 py-5 text-right type-3 font-semibold">Views</th>
                <th className="px-8 py-5 text-right type-3 font-semibold">Visits</th>
                <th className="px-8 py-5 text-center type-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applicationsData.map((app, index) => (
                <tr key={app.uuid} className={`${index % 2 === 0 ? 'bg-white' : 'bg-black-5'} hocus:bg-black-10`}>
                  <td className="px-8 py-5">
                    <div>
                      <div className="font-semibold text-cardinal-red">{app.name}</div>
                      <div className="text-sm text-black-80">{app.hostname}</div>
                      <div className="text-xs text-black-60 font-mono mt-1">{app.uuid}</div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="font-semibold">{app.views.toLocaleString()}</div>
                    <div className="text-sm text-black-80">{app.viewsPercentage.toFixed(1)}%</div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="font-semibold">{app.visits.toLocaleString()}</div>
                    <div className="text-sm text-black-80">{app.visitsPercentage.toFixed(1)}%</div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <a
                      href={`/applications/${app.uuid}`}
                      className="inline-block bg-cardinal-red text-white px-5 py-2 rounded text-sm hocus:bg-cardinal-red-dark"
                    >
                      View Details
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {applicationsData.length === 0 && (
          <div className="text-center py-20">
            <p className="text-black-80">No applications found.</p>
          </div>
        )}
      </div>
    </Container>
  )
}