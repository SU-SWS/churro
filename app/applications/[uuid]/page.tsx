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
  // Re-introduce the type inside the component for type safety.
  const typedParams: { uuid: string } = params;

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
      try {
        setLoadingStep('Fetching application info...');
        const res = await fetch(`/api/acquia/applications?subscriptionUuid=${subscriptionUuid}`);
        const apps = await handleApiResponse(res);
        if (!apps) return; // Authorization error handled by handleApiResponse

        const app = Array.isArray(apps) ? apps.find((a: any) => a.uuid === typedParams.uuid) : null;
        setAppName(app ? app.name : '');
      } catch (err) {
        console.error('Error fetching app name:', err);
        setAppName('');
      } finally {
        setLoadingStep('');
      }
    };
    if (subscriptionUuid) fetchAppName();
  }, [subscriptionUuid, typedParams.uuid]);

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

      const dailyQuery = new URLSearchParams({ ...paramsObj, resolution: 'day' }).toString();

      setLoadingStep('Fetching views and visits...');
      const [dailyViewsRes, dailyVisitsRes] = await Promise.all([
        fetch(`/api/acquia/views?${dailyQuery}`),
        fetch(`/api/acquia/visits?${dailyQuery}`),
      ]);

      // Handle authorization errors
      const dailyViewsRaw = await handleApiResponse(dailyViewsRes);
      const dailyVisitsRaw = await handleApiResponse(dailyVisitsRes);

      if (!dailyViewsRaw || !dailyVisitsRaw) return; // Authorization error handled

      // Helper to process and aggregate daily data with proper types
      const processDailyData = (rawData: AcquiaApiResponse, metric: 'views' | 'visits'): DailyDataPoint[] => {
        const dailyMap = new Map<string, number>();
        const dataArray = rawData.data || [];

        const appData = dataArray.filter((d) => d.applicationUuid === typedParams.uuid);

        for (const record of appData) {
          const date = record.date.split('T')[0];
          const value = record[metric] || 0;
          dailyMap.set(date, (dailyMap.get(date) || 0) + value);
        }

        return Array.from(dailyMap.entries())
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => a.date.localeCompare(b.date));
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

  return (
    <div className="min-h-screen p-20">
      <header className="mb-8 text-center">
        <div className="mt-2 text-black text-lg">
          <h1 className="font-bold mb-6">
        Views and Visits Data for {appName ? appName : <span className="font-mono">{typedParams.uuid}</span>}
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

          <p className="mt-2 text-sm">
            (Note that it can take several minutes to fetch data from the Acquia API.)
          </p>
        </form>
      </div>
      {error && (
        <div className="mb-4 text-red-600">{error}</div>
      )}
      {!appName && !loading ? (
        <div>No application found with UUID: <span className="font-mono">{typedParams.uuid}</span></div>
      ) : (
        // Individual application details.
        <div className="text-lg my-40 max-w-4xl mx-auto bg-white rounded-lg shadow-md p-20 border border-gray-400">
          <div className="mb-4">
            <strong>Name:</strong> {appName}
          </div>
          <div className="mb-4">
            <strong>UUID:</strong> <span className="font-mono">{typedParams.uuid}</span>
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
    </div>
  );
}