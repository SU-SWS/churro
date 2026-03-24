'use client';

import React, { useState, useEffect } from 'react';
import CountUpTimer from '@/components/CountUpTimer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

const DEFAULT_SUBSCRIPTION_UUID = process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID || '';

const compactNumberFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const AXIS_TICK_FONT_SIZE = 15;
const LABEL_FONT_SIZE = 12;

// Chart stroke/fill colors — Tailwind classes don't apply to Recharts SVG props; use hex or CSS color strings
const CARDINAL_RED = '#8C1515'; // Decanter 'cardinal-red' token
const DIGITAL_RED = '#B83A4B';  // Decanter 'digital-red' token

// Define a type for our chart data points
interface DailyDataPoint {
  date: string;
  value: number;
}

// Define a type for the expected API response structure
interface AcquiaApiResponse {
  data?: Array<{
    applicationUuid: string;
    date: string;
    views?: number;
    visits?: number;
  }>;
}

// Use 'any' in the signature to satisfy the Next.js build process for client components.
export default function ApplicationDetailPage({ params }: any) {
  // Use a single stable uuid primitive from params
  const { uuid } = params;

  const [subscriptionUuid, setSubscriptionUuid] = useState(DEFAULT_SUBSCRIPTION_UUID);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const [appName, setAppName] = useState<string>('');
  const [views, setViews] = useState(0);
  const [visits, setVisits] = useState(0);
  const [viewsPct, setViewsPct] = useState(0);
  const [visitsPct, setVisitsPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dailyViews, setDailyViews] = useState<DailyDataPoint[]>([]);
  const [dailyVisits, setDailyVisits] = useState<DailyDataPoint[]>([]);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check for authorization errors from API calls
  const handleApiResponse = async (response: Response) => {
    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      setAuthError(errorData.error || 'Access denied. You do not have permission to view this application.');
      return null;
    }
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  };

  // Fetch application name on mount or when subscriptionUuid changes
  useEffect(() => {
    const fetchAppName = async () => {
      if (!subscriptionUuid) return;

      try {
        setLoadingStep('Fetching application info...');

        // Add cache-busting parameter to force fresh request
        const params = new URLSearchParams({
          subscriptionUuid,
          t: Date.now().toString()
        });

        const fetchOptions: RequestInit = {
          cache: 'reload', // Forces request to go to network, bypassing cache
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        };

        const res = await fetch(`/api/acquia/applications?${params}`, fetchOptions);
        if (!res.ok) {
          console.error('applications API responded with non-OK status', res.status);
          setAppName('');
          return;
        }
        const apps = await res.json();
        console.debug('fetchAppName', { subscriptionUuid, uuid, appsLength: apps?.length ?? 0 });

        // apps is now the array directly, not wrapped in _embedded
        const app = Array.isArray(apps) ? apps.find((a: any) => a.uuid === uuid) : null;
        console.debug('found app:', { found: !!app, appName: app?.name });
        setAppName(app ? app.name : '');
      } catch (err) {
        console.error('Error fetching app name:', err);
        setAppName('');
      } finally {
        setLoadingStep('');
      }
    };

    fetchAppName();
  }, [subscriptionUuid, uuid]);

  // Restore the previous page title when this component unmounts (e.g. client-side navigation away)
  useEffect(() => {
    const previousTitle = document.title;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Update document title when app name is loaded
  useEffect(() => {
    document.title = appName ? `${appName} - CHURRO` : 'CHURRO';
  }, [appName]);

  // Show authorization error if user doesn't have access
  if (authError) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h1>
            <p className="text-red-700 mb-4">{authError}</p>
            <p className="text-sm text-red-600">
              If you believe you should have access to this application, please contact your administrator.
            </p>
            <div className="mt-4">
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
              >
                Return to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fetchAppDetail = async () => {
    setLoading(true);
    setLoadingStep('Fetching analytics data...');
    setError(null);
    setElapsedTime(null);
    const startTime = Date.now();
    try {
      const paramsObj: Record<string, string> = {};
      if (subscriptionUuid) paramsObj.subscriptionUuid = subscriptionUuid;
      if (from) paramsObj.from = from;
      if (to) paramsObj.to = to;
      paramsObj.resolution = 'day';

      // Add cache-busting parameter AFTER building the main params
      const cacheBustingParam = Date.now().toString();

      // Build query string with cache-busting parameter
      const baseQuery = new URLSearchParams(paramsObj).toString();
      const dailyQuery = `${baseQuery}&t=${cacheBustingParam}`;

      // Disable browser caching completely - let server-side cache handle it
      const fetchOptions: RequestInit = {
        cache: 'reload', // Forces request to go to network, bypassing cache
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      };

      setLoadingStep('Fetching views and visits...');
      const [dailyViewsRes, dailyVisitsRes] = await Promise.all([
        fetch(`/api/acquia/views?${dailyQuery}`, fetchOptions),
        fetch(`/api/acquia/visits?${dailyQuery}`, fetchOptions),
      ]);

      // Handle authorization errors
      const dailyViewsRaw = await handleApiResponse(dailyViewsRes);
      const dailyVisitsRaw = await handleApiResponse(dailyVisitsRes);

      if (!dailyViewsRaw || !dailyVisitsRaw) return; // Authorization error handled

      setLoadingStep('Processing data...');

      console.log('📊 Application detail - processing data for UUID:', uuid);
      console.log('📊 Visits data length:', dailyVisitsRaw.data?.length);
      console.log('📈 Views data length:', dailyViewsRaw.data?.length);

      // Helper to process and aggregate daily data with proper types
      const processDailyData = (rawData: AcquiaApiResponse, metric: 'views' | 'visits'): DailyDataPoint[] => {
        const dailyMap = new Map<string, number>();
        const dataArray = rawData.data || [];

        // Filter for this specific application using the uuid from params
        const appData = dataArray.filter((d) => d.applicationUuid === uuid);
        console.log(`📊 Processing ${metric} for app ${uuid}: found ${appData.length} records`);

        for (const record of appData) {
          const date = record.date.split('T')[0];
          const value = record[metric] || 0;
          dailyMap.set(date, (dailyMap.get(date) || 0) + value);
        }

        const result = Array.from(dailyMap.entries())
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => a.date.localeCompare(b.date));

        console.log(`📊 Daily ${metric} data points:`, result.length);
        return result;
      };

      const processedDailyViews = processDailyData(dailyViewsRaw, 'views');
      const processedDailyVisits = processDailyData(dailyVisitsRaw, 'visits');

      setDailyViews(processedDailyViews);
      setDailyVisits(processedDailyVisits);

      const appTotalViews = processedDailyViews.reduce((sum, day) => sum + day.value, 0);
      const appTotalVisits = processedDailyVisits.reduce((sum, day) => sum + day.value, 0);

      const overallViewsData = dailyViewsRaw.data || [];
      const overallVisitsData = dailyVisitsRaw.data || [];

      const overallTotalViews = overallViewsData.reduce((sum: number, v: any) => sum + (v.views || 0), 0);
      const overallTotalVisits = overallVisitsData.reduce((sum: number, v: any) => sum + (v.visits || 0), 0);

      setViews(appTotalViews);
      setVisits(appTotalVisits);
      setViewsPct(overallTotalViews > 0 ? (appTotalViews / overallTotalViews) * 100 : 0);
      setVisitsPct(overallTotalVisits > 0 ? (appTotalVisits / overallTotalVisits) * 100 : 0);

      setLoadingStep('Complete!');
    } catch (err) {
      setError('Failed to fetch application details.');
      console.error(err);
    } finally {
      const endTime = Date.now();
      setElapsedTime((endTime - startTime) / 1000);
      setLoading(false);
      setLoadingStep('');
    }
  };

  const clearCache = async () => {
    setCacheClearing(true);
    try {
      console.log('🗑️ Attempting to clear cache...');

      // Clear browser cache first
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('🗑️ Cleared browser caches:', cacheNames);
      }

      // Clear server cache
      const response = await fetch('/api/cache', { method: 'DELETE' });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Server cache cleared:', result);

        const environment = result.environment || 'unknown';
        const method = result.method || 'unknown';

        alert(`Cache cleared successfully!\nEnvironment: ${environment}\nMethod: ${method}\nBrowser caches also cleared.\n\nIf you still see stale data, try refreshing the page.`);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Failed to clear cache:', errorData);
        alert(`Failed to clear cache: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Cache clearing error:', error);
      alert(`Error clearing cache: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setCacheClearing(false);
    }
  };  return (
    <div className="min-h-screen p-20">
      <header className="mb-8 text-center">
        <div className="mt-2 text-black text-lg">
          <h1 className="font-bold mb-6">
            Views and Visits Data for {appName ? appName : <span className="font-mono">{uuid}</span>}
          </h1>
        </div>
      </header>

      <div className="mb-8 max-w-xl mx-auto bg-black-10 rounded-lg p-15 border-2 border-black-10 mb-25">
        <form>
          <label
            htmlFor="subscriptionUuid"
            className="font-semibold mb-2 text-lg"
          >
            Subscription UUID
          </label>
          <input
            id="subscriptionUuid"
            type="text"
            value={subscriptionUuid}
            onChange={e => setSubscriptionUuid(e.target.value)}
            className="w-full p-2 border rounded mb-4"
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-10">
            <div>
              <label htmlFor="dateFrom" className="font-semibold mb-2 text-lg">
                From Date
              </label>
              <input
                type="date"
                id="dateFrom"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label htmlFor="dateTo" className="font-semibold mb-2 text-lg">
                To Date
              </label>
              <input
                type="date"
                id="dateTo"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="flex flex-col items-center my-8 gap-8">
            <button
              type="button"
              onClick={fetchAppDetail}
              disabled={loading || !subscriptionUuid || !from || !to}
              className="p-6 rounded-md font-semibold text-lg transition-colors duration-150 text-white bg-cardinal-red hocus:bg-black disabled:opacity-50"
            >
              {loading ? 'Fetching Data...' : 'Fetch Analytics Data'}
            </button>

            <button
              type="button"
              onClick={clearCache}
              disabled={cacheClearing}
              className="px-4 py-2 rounded-md font-semibold text-sm transition-colors duration-150 text-white bg-gray-600 hocus:bg-gray-800 disabled:opacity-50"
            >
              {cacheClearing ? 'Clearing...' : 'Clear Cache'}
            </button>

            {loading && (
              <div className="flex flex-col gap-8 items-center">
                <CountUpTimer isRunning={loading} />
                <div className="text-xl font-semibold text-digital-blue">{loadingStep}</div>
              </div>
            )}

            {!loading && elapsedTime !== null && (
              <div className="flex flex-col items-center gap-8">
                <CountUpTimer isRunning={false} finalTime={elapsedTime} />
                <div className="text-xl font-semibold text-digital-green">
                  Data loaded in {elapsedTime.toFixed(1)} seconds
                </div>
              </div>
            )}
          </div>

          <p className="mt-2 text-sm text-center">
            (Note that it can take several minutes to fetch data from the Acquia API.)
          </p>
        </form>
      </div>

      {error && (
        <div className="mb-4 text-red-600">{error}</div>
      )}

      {/* Individual Application Details - Summary */}
      {!appName && !loading ? (
        <div>No application found with UUID: <span className="font-mono">{uuid}</span></div>
      ) : (
        appName && (
          <div className="text-lg mb-8 max-w-4xl mx-auto bg-white rounded-lg shadow-md p-20 border border-gray-400">
            <div className="mb-4">
              <strong>Name:</strong> {appName}
            </div>
            <div className="mb-4">
              <strong>UUID:</strong> <span className="font-mono">{uuid}</span>
            </div>
            <div className="mb-4">
              <strong>Views{from && to ? ` (${from} to ${to})` : ''}:</strong> {views.toLocaleString()} ({viewsPct.toFixed(1)}%)
            </div>
            <div className="mb-4">
              <strong>Visits{from && to ? ` (${from} to ${to})` : ''}:</strong> {visits.toLocaleString()} ({visitsPct.toFixed(1)}%)
            </div>
          </div>
        )
      )}

      {/* Charts Section - Full Width */}
      {!loading && (views > 0 || visits > 0) && (
        <section className="mb-8">
          <div className="space-y-8">
            <div className="w-full p-6 rounded-lg shadow-md bg-black-10">
              <h4 className="text-xl font-semibold mb-6 text-center text-cardinal-red">Daily Views</h4>
              <div role="img" aria-label={`Daily Views line chart${appName ? ` for ${appName}` : ''}${from && to ? `, ${from} to ${to}` : ''}`} tabIndex={0}>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={dailyViews}
                  margin={{ top: 5, right: 30, left: 60, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    fontSize={AXIS_TICK_FONT_SIZE}
                    type="category"
                    tickFormatter={(value) => {
                      // Parse YYYY-MM-DD format directly to avoid timezone issues
                      const [, month, day] = value.split('-');
                      return `${parseInt(month, 10)}/${parseInt(day, 10)}`;
                    }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    fontSize={AXIS_TICK_FONT_SIZE}
                    tickFormatter={(value) =>
                      compactNumberFormat.format(value as number)
                    }
                  />
                  {/* Tooltip shown only when per-point labels are suppressed (>31 data points) */}
                  {dailyViews.length > 31 && (
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), 'Views']}
                      labelFormatter={(label: string) => {
                        const [year, month, day] = label.split('-');
                        return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Views"
                    stroke={CARDINAL_RED}
                    strokeWidth={2}
                    dot={true}
                    label={dailyViews.length <= 31 ? {
                      position: 'top',
                      fontSize: LABEL_FONT_SIZE,
                      fill: CARDINAL_RED,
                      formatter: (value: number) => value.toLocaleString(),
                      style: {
                        textShadow: '2px 2px 4px white, -2px -2px 4px white, 2px -2px 4px white, -2px 2px 4px white',
                        fontWeight: 'bold'
                      }
                    } : false}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-digital-blue hocus:underline">
                  View data table
                </summary>
                <table className="mt-2 w-full text-sm border-collapse">
                  <caption className="sr-only">Daily Views data</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="text-left p-2 border border-black-20">Date</th>
                      <th scope="col" className="text-right p-2 border border-black-20">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyViews.map(({ date, value }) => {
                      const [year, month, day] = date.split('-');
                      return (
                        <tr key={date}>
                          <td className="p-2 border border-black-20">{`${parseInt(month, 10)}/${parseInt(day, 10)}/${year.slice(-2)}`}</td>
                          <td className="text-right p-2 border border-black-20">{value.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            </div>

            <div className="w-full p-6 rounded-lg shadow-md bg-black-10">
              <h4 className="text-xl font-semibold mb-6 text-center text-cardinal-red">Daily Visits</h4>
              <div role="img" aria-label={`Daily Visits line chart${appName ? ` for ${appName}` : ''}${from && to ? `, ${from} to ${to}` : ''}`} tabIndex={0}>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={dailyVisits}
                  margin={{ top: 5, right: 30, left: 60, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    fontSize={AXIS_TICK_FONT_SIZE}
                    type="category"
                    tickFormatter={(value) => {
                      // Parse YYYY-MM-DD format directly to avoid timezone issues
                      const [, month, day] = value.split('-');
                      return `${parseInt(month, 10)}/${parseInt(day, 10)}`;
                    }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    fontSize={AXIS_TICK_FONT_SIZE}
                    tickFormatter={(value) =>
                      compactNumberFormat.format(value as number)
                    }
                  />
                  {/* Tooltip shown only when per-point labels are suppressed (>31 data points) */}
                  {dailyVisits.length > 31 && (
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), 'Visits']}
                      labelFormatter={(label: string) => {
                        const [year, month, day] = label.split('-');
                        return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Visits"
                    stroke={DIGITAL_RED}
                    strokeWidth={2}
                    dot={true}
                    label={dailyVisits.length <= 31 ? {
                      position: 'top',
                      fontSize: LABEL_FONT_SIZE,
                      fill: DIGITAL_RED,
                      formatter: (value: number) => value.toLocaleString(),
                      style: {
                        textShadow: '2px 2px 4px white, -2px -2px 4px white, 2px -2px 4px white, -2px 2px 4px white',
                        fontWeight: 'bold'
                      }
                    } : false}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-digital-blue hocus:underline">
                  View data table
                </summary>
                <table className="mt-2 w-full text-sm border-collapse">
                  <caption className="sr-only">Daily Visits data</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="text-left p-2 border border-black-20">Date</th>
                      <th scope="col" className="text-right p-2 border border-black-20">Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyVisits.map(({ date, value }) => {
                      const [year, month, day] = date.split('-');
                      return (
                        <tr key={date}>
                          <td className="p-2 border border-black-20">{`${parseInt(month, 10)}/${parseInt(day, 10)}/${year.slice(-2)}`}</td>
                          <td className="text-right p-2 border border-black-20">{value.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            </div>
          </div>
        </section>
      )}

      {/* Debug Info Section - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 rounded">
          <h3 className="font-bold">Debug Info</h3>
          <pre className="text-xs mt-2">
            {JSON.stringify({
              uuid,
              subscriptionUuid,
              appName,
              visitsDataLength: dailyVisits?.length || 0,
              viewsDataLength: dailyViews?.length || 0,
              totalViews: views,
              totalVisits: visits,
              hasError: !!error,
              loading,
              from,
              to,
              cacheClearing,
              cacheInfo: {
                visitsUrl: `/api/acquia/visits?subscriptionUuid=${subscriptionUuid}&from=${from}&to=${to}&resolution=day`,
                viewsUrl: `/api/acquia/views?subscriptionUuid=${subscriptionUuid}&from=${from}&to=${to}&resolution=day`,
              }
            }, null, 2)}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                console.log('🗑️ Clearing browser cache');
                if ('caches' in window) {
                  caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                  });
                }
              }}
              className="px-4 py-2 bg-red-500 text-white rounded text-sm"
            >
              Clear Browser Cache
            </button>
            <button
              onClick={clearCache}
              disabled={cacheClearing}
              className="px-4 py-2 bg-orange-500 text-white rounded text-sm disabled:opacity-50"
            >
              {cacheClearing ? 'Clearing...' : 'Clear Server Cache'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}