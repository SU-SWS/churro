'use client';

import React, { useState, useEffect } from 'react';
import CountUpTimer from '@/components/CountUpTimer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DEFAULT_SUBSCRIPTION_UUID = process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID || '';
interface PageProps {
  params: { uuid: string };
}

export default function ApplicationDetailPage({ params }: any) {
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
  const [dailyViews, setDailyViews] = useState([]);
  const [dailyVisits, setDailyVisits] = useState([]);

  // Fetch application name on mount or when subscriptionUuid changes
  useEffect(() => {
    const fetchAppName = async () => {
      try {
        setLoadingStep('Fetching application info...');
        const res = await fetch(`/api/acquia/applications?subscriptionUuid=${subscriptionUuid}`);
        const apps = await res.json();
        const app = Array.isArray(apps) ? apps.find((a: any) => a.uuid === params.uuid) : null;
        setAppName(app ? app.name : '');
      } catch {
        setAppName('');
      } finally {
        setLoadingStep('');
      }
    };
    if (subscriptionUuid) fetchAppName();
  }, [subscriptionUuid, params.uuid]);

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

      // We only need to fetch daily data, as we can calculate totals from it.
      const dailyQuery = new URLSearchParams({ ...paramsObj, resolution: 'day' }).toString();

      setLoadingStep('Fetching views and visits...');
      const [dailyViewsRes, dailyVisitsRes] = await Promise.all([
        fetch(`/api/acquia/views?${dailyQuery}`),
        fetch(`/api/acquia/visits?${dailyQuery}`),
      ]);

      const [dailyViewsRaw, dailyVisitsRaw] = await Promise.all([
        dailyViewsRes.ok ? dailyViewsRes.json() : [],
        dailyVisitsRes.ok ? dailyVisitsRes.json() : [],
      ]);

      // Helper to process and aggregate daily data
      const processDailyData = (rawData: any[], metric: 'views' | 'visits') => {
        const dailyMap = new Map<string, number>();
        // Filter for the specific application we are viewing
        const appData = (rawData || []).filter((d: any) => d.applicationUuid === params.uuid);

        for (const record of appData) {
          // FIX #1: The property is named 'date', not 'timestamp'
          const date = record.date.split('T')[0];
          // FIX #2: The value is in either the 'views' or 'visits' property
          const value = record[metric] || 0;
          dailyMap.set(date, (dailyMap.get(date) || 0) + value);
        }

        return Array.from(dailyMap.entries())
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => a.date.localeCompare(b.date));
      };

      const processedDailyViews = processDailyData(dailyViewsRaw.data, 'views');
      const processedDailyVisits = processDailyData(dailyVisitsRaw.data, 'visits');

      setDailyViews(processedDailyViews as any);
      setDailyVisits(processedDailyVisits as any);

      // Calculate totals for this app from the daily data
      const appTotalViews = processedDailyViews.reduce((sum, day) => sum + day.value, 0);
      const appTotalVisits = processedDailyVisits.reduce((sum, day) => sum + day.value, 0);

      // Calculate overall totals for percentage calculation
      const overallTotalViews = (dailyViewsRaw.data || []).reduce((sum: number, v: any) => sum + (v.views || 0), 0);
      const overallTotalVisits = (dailyVisitsRaw.data || []).reduce((sum: number, v: any) => sum + (v.visits || 0), 0);

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
    <div className="min-h-screen p-8" style={{
      backgroundColor: 'var(--stanford-white)',
      fontFamily: 'Source Sans Pro, Arial, sans-serif',
      color: 'var(--stanford-black)',
    }}>
      <h1 className="text-2xl font-bold mb-6">
        Views and Visits Data for {appName ? appName : <span className="font-mono">{params.uuid}</span>}
      </h1>
      <section className="mb-8 max-w-xl mx-auto bg-white rounded-lg shadow-md p-6 border-2" style={{ borderColor: 'var(--stanford-cardinal)' }}>
        <form>
          <label
            htmlFor="subscriptionUuid"
            className="block font-semibold mb-2"
            style={{ color: 'var(--stanford-cardinal)' }}
          >
            Subscription UUID
          </label>
          <input
            id="subscriptionUuid"
            type="text"
            value={subscriptionUuid}
            onChange={e => setSubscriptionUuid(e.target.value)}
            className="w-full p-2 border rounded mb-4"
            style={{
              borderColor: 'var(--stanford-gray)',
              color: 'var(--stanford-black)',
              fontFamily: 'Source Sans Pro, Arial, sans-serif',
            }}
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium mb-2" style={{ color: 'var(--stanford-cardinal)' }}>
                From Date
              </label>
              <input
                type="date"
                id="dateFrom"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none"
                style={{
                  borderColor: 'var(--stanford-gray)',
                  color: 'var(--stanford-black)',
                  fontFamily: 'Source Sans Pro, Arial, sans-serif',
                }}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium mb-2" style={{ color: 'var(--stanford-cardinal)' }}>
                To Date
              </label>
              <input
                type="date"
                id="dateTo"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none"
                style={{
                  borderColor: 'var(--stanford-gray)',
                  color: 'var(--stanford-black)',
                  fontFamily: 'Source Sans Pro, Arial, sans-serif',
                }}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={fetchAppDetail}
              disabled={loading || !subscriptionUuid}
              className="px-6 py-2 rounded-md font-semibold transition-colors duration-150"
              style={{
                backgroundColor: 'var(--stanford-cardinal)',
                color: 'var(--stanford-white)',
                border: '2px solid var(--stanford-cardinal)',
                fontFamily: 'Source Sans Pro, Arial, sans-serif',
              }}
            >
              {loading ? 'Fetching Data...' : 'Fetch Analytics Data'}
            </button>
            {loading && (
              <div className="flex items-center space-x-3">
                <CountUpTimer isRunning={loading} />
                <div className="font-medium" style={{ color: 'var(--stanford-cardinal)' }}>{loadingStep}</div>
              </div>
            )}

            {!loading && elapsedTime !== null && (
              <div className="flex items-center space-x-3">
                <CountUpTimer isRunning={false} finalTime={elapsedTime} />
                <div className="font-medium" style={{ color: 'var(--stanford-gold)' }}>
                  Data loaded in {elapsedTime.toFixed(1)} seconds
                </div>
              </div>
            )}
          </div>

          <p className="mt-2 text-sm" style={{ color: 'var(--stanford-gray)' }}>
            (Note that it can take several minutes to fetch data from the Acquia API.)
          </p>
        </form>
      </section>
      {error && (
        <div className="mb-4 text-red-600">{error}</div>
      )}
      {!appName ? (
        <div>No application found with UUID: <span className="font-mono">{params.uuid}</span></div>
      ) : (
        <div>
          <div className="mb-4">
            <strong>Name:</strong> {appName}
          </div>
          <div className="mb-4">
            <strong>UUID:</strong> <span className="font-mono">{params.uuid}</span>
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