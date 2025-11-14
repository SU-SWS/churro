'use client';

import React, { useState, useEffect } from 'react';
import CountUpTimer from '@/components/CountUpTimer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DEFAULT_SUBSCRIPTION_UUID = process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID || '';

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

        console.log('📱 Fetching applications with cache-busting parameter');
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
      } catch (error) {
        console.error('Error fetching app name:', error);
        setAppName('');
      } finally {
        setLoadingStep('');
      }
    };

    fetchAppName();
  }, [subscriptionUuid, uuid]);

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
      // Add cache-busting parameter
      paramsObj.t = Date.now().toString();

      const dailyQuery = new URLSearchParams({ ...paramsObj, resolution: 'day' }).toString();

      // Disable browser caching completely - let server-side cache handle it
      const fetchOptions: RequestInit = {
        cache: 'reload', // Forces request to go to network, bypassing cache
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      };

      setLoadingStep('Fetching views and visits...');
      console.log('📊 Fetching analytics data with cache-busting parameter');
      const [dailyViewsRes, dailyVisitsRes] = await Promise.all([
        fetch(`/api/acquia/views?${dailyQuery}`, fetchOptions),
        fetch(`/api/acquia/visits?${dailyQuery}`, fetchOptions),
      ]);

      const [dailyViewsRaw, dailyVisitsRaw]: [AcquiaApiResponse, AcquiaApiResponse] = await Promise.all([
        dailyViewsRes.ok ? dailyViewsRes.json() : {},
        dailyVisitsRes.ok ? dailyVisitsRes.json() : {},
      ]);

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

      const overallTotalViews = overallViewsData.reduce((sum, v) => sum + (v.views || 0), 0);
      const overallTotalVisits = overallVisitsData.reduce((sum, v) => sum + (v.visits || 0), 0);

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

        alert(`Cache cleared successfully!\nEnvironment: ${environment}\nMethod: ${method}\nBrowser caches also cleared\n\nNote: Browser may still have cached responses. Use hard refresh if needed.`);

        // Reload data with fresh cache-busting parameter
        if (subscriptionUuid) {
          await fetchAppDetail();
        }
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
  };

  return (
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
              />
            </div>
          </div>

          <div className="flex flex-col items-center my-8 gap-8">
            <button
              type="button"
              onClick={fetchAppDetail}
              disabled={loading || !subscriptionUuid}
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
      {!appName && !loading ? (
        <div>No application found with UUID: <span className="font-mono">{uuid}</span></div>
      ) : (
        // Individual application details.
        <div className="text-lg my-40 max-w-4xl mx-auto bg-white rounded-lg shadow-md p-20 border border-gray-400">
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
      )}

      {/* Data Display Section */}
      {!loading && (views > 0 || visits > 0) && (
        <section className="mt-8">
          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <div className="p-4 rounded-lg shadow-md" style={{ backgroundColor: '#F9F6F2' }}>
              <h4 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--stanford-cardinal)' }}>Daily Views</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={dailyViews}
                  margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis tickFormatter={(value) => new Intl.NumberFormat('en-US').format(value as number)} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" name="Views" stroke="#8C1515" strokeWidth={2} dot={true} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="p-4 rounded-lg shadow-md" style={{ backgroundColor: '#F9F6F2' }}>
              <h4 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--stanford-cardinal)' }}>Daily Visits</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={dailyVisits}
                  margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis tickFormatter={(value) => new Intl.NumberFormat('en-US').format(value as number)} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" name="Visits" stroke="#B83A4B" strokeWidth={2} dot={true} />
                </LineChart>
              </ResponsiveContainer>
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