'use client';

import React, { useState, useEffect } from 'react';
import CountUpTimer from '@/components/CountUpTimer';

const DEFAULT_SUBSCRIPTION_UUID = process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID || "";

// Get current Pacific time formatted string
function getCurrentPacificTimeString() {
  const now = new Date();
  const pacificTime = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  return pacificTime;
}

async function fetchData(cacheBuster?: string) {
  const subscriptionUuid = DEFAULT_SUBSCRIPTION_UUID;

  if (!subscriptionUuid) {
    throw new Error('Subscription UUID is required. Please check your environment configuration.');
  }

  const params = new URLSearchParams({
    subscriptionUuid,
  });

  // Only add date parameters if we want to filter (comment out for now to match Dashboard behavior)
  // // Default to current month data (like the Dashboard)
  // const now = new Date();
  // const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  //
  // // Convert to ISO 8601 format with time components as required by Acquia API
  // const defaultFrom = startOfMonth.toISOString(); // Full ISO format: 2025-11-01T08:00:00.000Z
  // const defaultTo = now.toISOString(); // Full ISO format: 2025-11-14T23:59:59.000Z
  //
  // params.append('from', defaultFrom);
  // params.append('to', defaultTo);

  if (cacheBuster) {
    params.set('t', cacheBuster);
  }

  const queryString = params.toString();
  const suffix = queryString ? `?${queryString}` : '';

  const fetchOptions: RequestInit = {
    cache: 'reload', // Forces request to go to network, bypassing cache
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  };

  console.log('📱 Fetching applications with URL:', `/api/acquia/applications${suffix}`);
  console.log('📊 Fetching views with URL:', `/api/acquia/views${suffix}`);
  console.log('📈 Fetching visits with URL:', `/api/acquia/visits${suffix}`);
  console.log('🔧 Environment check:', {
    hasSubscriptionUuid: !!DEFAULT_SUBSCRIPTION_UUID,
    subscriptionUuidLength: DEFAULT_SUBSCRIPTION_UUID?.length || 0,
    noDateFilter: true // Fetching all available data like Dashboard
  });

  const [appsRes, viewsRes, visitsRes] = await Promise.all([
    fetch(`/api/acquia/applications${suffix}`, fetchOptions),
    fetch(`/api/acquia/views${suffix}`, fetchOptions),
    fetch(`/api/acquia/visits${suffix}`, fetchOptions),
  ]);

  // Check for HTTP errors
  if (!appsRes.ok) {
    const errorText = await appsRes.text();
    console.error('❌ Applications API Error:', { status: appsRes.status, statusText: appsRes.statusText, response: errorText });
    throw new Error(`Failed to fetch applications: ${appsRes.status} ${appsRes.statusText} - ${errorText}`);
  }
  if (!viewsRes.ok) {
    const errorText = await viewsRes.text();
    console.error('❌ Views API Error:', { status: viewsRes.status, statusText: viewsRes.statusText, response: errorText });
    throw new Error(`Failed to fetch views: ${viewsRes.status} ${viewsRes.statusText} - ${errorText}`);
  }
  if (!visitsRes.ok) {
    const errorText = await visitsRes.text();
    console.error('❌ Visits API Error:', { status: visitsRes.status, statusText: visitsRes.statusText, response: errorText });
    throw new Error(`Failed to fetch visits: ${visitsRes.status} ${visitsRes.statusText} - ${errorText}`);
  }

  const [apps, viewsRaw, visitsRaw] = await Promise.all([
    appsRes.json(),
    viewsRes.json(),
    visitsRes.json(),
  ]);

  console.log('📱 Applications response:', { length: apps?.length, sample: apps?.[0] });
  console.log('📊 Views response:', { length: viewsRaw?.data?.length || viewsRaw?.length, type: typeof viewsRaw });
  console.log('📈 Visits response:', { length: visitsRaw?.data?.length || visitsRaw?.length, type: typeof visitsRaw });

  // Handle the response format from Acquia API
  const views = Array.isArray(viewsRaw)
    ? viewsRaw
    : viewsRaw && Array.isArray(viewsRaw.data)
      ? viewsRaw.data
      : [];
  const visits = Array.isArray(visitsRaw)
    ? visitsRaw
    : visitsRaw && Array.isArray(visitsRaw.data)
      ? visitsRaw.data
      : [];

  return { apps, views, visits };
}

// Helper function to aggregate application statistics
function getAppStats(apps: any[], views: any[], visits: any[]) {
  // UUIDs to exclude from the applications list
  const EXCLUDED_UUIDS = [
    '2b2d2517-3839-414e-85a4-7183adc22283',
    '1ef402a7-c301-42d7-9b63-f226fa1b2329'
  ];

  // Filter out excluded applications
  const filteredApps = apps.filter(app => !EXCLUDED_UUIDS.includes(app.uuid));

  console.log(`🔍 Filtered applications: ${apps.length} -> ${filteredApps.length} (excluded ${apps.length - filteredApps.length} apps)`);

  // Create summaries by application UUID
  const viewsByApp: Record<string, number> = {};
  const visitsByApp: Record<string, number> = {};

  // Sum views by application UUID (only for non-excluded apps)
  views.forEach(record => {
    const uuid = record.applicationUuid;
    if (uuid && !EXCLUDED_UUIDS.includes(uuid)) {
      viewsByApp[uuid] = (viewsByApp[uuid] || 0) + (record.views || 0);
    }
  });

  // Sum visits by application UUID (only for non-excluded apps)
  visits.forEach(record => {
    const uuid = record.applicationUuid;
    if (uuid && !EXCLUDED_UUIDS.includes(uuid)) {
      visitsByApp[uuid] = (visitsByApp[uuid] || 0) + (record.visits || 0);
    }
  });

  // Calculate totals for percentage calculations (from all non-excluded data)
  const totalViews = Object.values(viewsByApp).reduce((sum, views) => sum + views, 0);
  const totalVisits = Object.values(visitsByApp).reduce((sum, visits) => sum + visits, 0);

  console.log('📊 Data totals:', { totalViews, totalVisits, appsWithData: Object.keys(viewsByApp).length });

  // Generate stats for each filtered application
  const stats = filteredApps.map(app => {
    const views = viewsByApp[app.uuid] || 0;
    const visits = visitsByApp[app.uuid] || 0;
    const viewsPct = totalViews > 0 ? (views / totalViews) * 100 : 0;
    const visitsPct = totalVisits > 0 ? (visits / totalVisits) * 100 : 0;

    return {
      uuid: app.uuid,
      name: app.name || `App ${app.uuid.substring(0, 8)}`,
      views,
      visits,
      viewsPct,
      visitsPct
    };
  }).filter(app => app.views > 0 || app.visits > 0) // Only include apps with data
    .sort((a, b) => (b.views + b.visits) - (a.views + a.visits)); // Sort by total activity

  console.log('📊 Generated stats for', stats.length, 'applications');
  return stats;
}

export default function ApplicationsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [views, setViews] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setElapsedTime(null);

    const startTime = Date.now();

    try {
      console.log('📊 Fetching applications data with cache-busting parameter');
      const { apps, views, visits } = await fetchData(Date.now().toString());

      const calculatedStats = getAppStats(apps, views, visits);      setApps(apps);
      setViews(views);
      setVisits(visits);
      setStats(calculatedStats);

      console.log('✅ Applications data loaded successfully');
    } catch (err) {
      console.error('❌ Failed to load applications data:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching data';
      console.error('❌ Full error details:', {
        error: err,
        stack: err instanceof Error ? err.stack : undefined,
        message: errorMessage,
        type: typeof err,
        name: err instanceof Error ? err.name : undefined
      });
      setError(errorMessage);
    } finally {
      const endTime = Date.now();
      const timeElapsed = (endTime - startTime) / 1000;
      setElapsedTime(timeElapsed);
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-20">
      <div className="flex justify-between items-center mb-25">
        <div>
          <h1 className="text-2xl font-bold text-gc-black mb-8">Application Views & Visits</h1>
          <div className="text-base text-black-60">
            Current month-to-date data (as of {getCurrentPacificTimeString()})
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-50">
          <div className="flex flex-col gap-15 items-center">
            <CountUpTimer isRunning={loading} />
            <div className="text-xl font-semibold text-digital-blue">Loading applications data...</div>
          </div>
        </div>
      )}

      {!loading && elapsedTime !== null && (
        <div className="text-center py-25">
          <div className="flex flex-col gap-10 items-center">
            <CountUpTimer isRunning={false} finalTime={elapsedTime} />
            <div className="text-lg font-semibold text-digital-green">
              Data loaded in {elapsedTime?.toFixed(1) || '0.0'} seconds
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="text-center py-50">
          <div className="text-xl font-semibold text-cardinal-red mb-15">Error: {error}</div>
          <button
            onClick={loadData}
            className="px-20 py-10 bg-cardinal-red text-white rounded-md font-semibold hocus:bg-black transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && stats.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-black-20 overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-black-10">
              <tr>
                <th className="px-20 py-15 text-left font-semibold text-gc-black border-b border-black-20">Application</th>
                <th className="px-20 py-15 text-left font-semibold text-gc-black border-b border-black-20">UUID</th>
                <th className="px-20 py-15 text-right font-semibold text-gc-black border-b border-black-20">Views</th>
                <th className="px-20 py-15 text-right font-semibold text-gc-black border-b border-black-20">% of Views</th>
                <th className="px-20 py-15 text-right font-semibold text-gc-black border-b border-black-20">Visits</th>
                <th className="px-20 py-15 text-right font-semibold text-gc-black border-b border-black-20">% of Visits</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((app, index) => (
                <tr key={app.uuid} className={index % 2 === 0 ? 'bg-white' : 'bg-black-10'}>
                  <td className="px-20 py-15 text-gc-black border-b border-black-10">
                    <a
                      href={`/applications/${app.uuid}`}
                      className="text-cardinal-red hocus:text-black font-medium transition-colors"
                    >
                      {app.name}
                    </a>
                  </td>
                  <td className="px-20 py-15 text-black-60 border-b border-black-10 font-mono text-sm">{app.uuid}</td>
                  <td className="px-20 py-15 text-right text-gc-black border-b border-black-10 font-semibold">
                    {app.views.toLocaleString()}
                  </td>
                  <td className="px-20 py-15 text-right text-black-60 border-b border-black-10">{app.viewsPct.toFixed(1)}%</td>
                  <td className="px-20 py-15 text-right text-gc-black border-b border-black-10 font-semibold">
                    {app.visits.toLocaleString()}
                  </td>
                  <td className="px-20 py-15 text-right text-black-60 border-b border-black-10">{app.visitsPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && stats.length === 0 && (
        <div className="text-center py-50 bg-white rounded-lg shadow-md border border-black-20 p-30">
          <div className="text-xl text-black-60 mb-15">No application data found</div>
          <div className="text-base text-black-60 mb-20">
            This could be due to:
            <ul className="list-disc list-inside mt-10 space-y-5 text-left max-w-md mx-auto">
              <li>Missing subscription UUID in environment configuration</li>
              <li>No data available for the current time period</li>
              <li>API connection issues</li>
            </ul>
          </div>
          <div className="text-sm text-black-60 bg-black-10 p-15 rounded font-mono">
            Subscription UUID: {DEFAULT_SUBSCRIPTION_UUID || 'NOT_SET'}
          </div>
        </div>
      )}
    </div>
  );
}