'use client';

import React, { useState, useEffect } from 'react';
import CountUpTimer from '@/components/CountUpTimer';

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
      const query = new URLSearchParams(paramsObj).toString();

      setLoadingStep('Fetching views and visits...');
      const [viewsRes, visitsRes] = await Promise.all([
        fetch(`/api/acquia/views?${query}`),
        fetch(`/api/acquia/visits?${query}`),
      ]);
      const [viewsRaw, visitsRaw] = await Promise.all([
        viewsRes.ok ? viewsRes.json() : [],
        visitsRes.ok ? visitsRes.json() : [],
      ]);
      const viewsArr = Array.isArray(viewsRaw)
        ? viewsRaw
        : viewsRaw && Array.isArray(viewsRaw.data)
        ? viewsRaw.data
        : [];
      const visitsArr = Array.isArray(visitsRaw)
        ? visitsRaw
        : visitsRaw && Array.isArray(visitsRaw.data)
        ? visitsRaw.data
        : [];
      const appViewsTotal = viewsArr
        .filter((v: any) => v.uuid === params.uuid || v.applicationUuid === params.uuid)
        .reduce((sum: number, v: any) => sum + (v.views || 0), 0);

      const appVisitsTotal = visitsArr
        .filter((v: any) => v.uuid === params.uuid || v.applicationUuid === params.uuid)
        .reduce((sum: number, v: any) => sum + (v.visits || 0), 0);

      const totalViews = viewsArr.reduce((sum: number, v: any) => sum + (v.views || 0), 0);
      const totalVisits = visitsArr.reduce((sum: number, v: any) => sum + (v.visits || 0), 0);

      setViews(appViewsTotal);
      setVisits(appVisitsTotal);
      setViewsPct(totalViews ? (appViewsTotal / totalViews) * 100 : 0);
      setVisitsPct(totalVisits ? (appVisitsTotal / totalVisits) * 100 : 0);
      setLoadingStep('Complete!');
    } catch (err) {
      setError('Failed to fetch application details.');
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
      <section className="mb-8 max-w-xl mx-auto bg-white rounded-lg p-6 border-2">
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
    </div>
  );
}