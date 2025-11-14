'use client';

import React, { useState, useEffect } from 'react';

async function fetchData(cacheBuster?: string) {
  const params = new URLSearchParams();
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

  const [appsRes, viewsRes, visitsRes] = await Promise.all([
    fetch(`/api/acquia/applications${suffix}`, fetchOptions),
    fetch(`/api/acquia/views${suffix}`, fetchOptions),
    fetch(`/api/acquia/visits${suffix}`, fetchOptions),
  ]);
  const [apps, viewsRaw, visitsRaw] = await Promise.all([
    appsRes.ok ? appsRes.json() : [],
    viewsRes.ok ? viewsRes.json() : [],
    visitsRes.ok ? visitsRes.json() : [],
  ]);

  // Defensive: ensure arrays
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

function getAppStats(apps: any[], views: { map: (arg0: (v: any) => any[]) => Iterable<readonly [PropertyKey, any]>; reduce: (arg0: (sum: any, v: any) => any, arg1: number) => any; }, visits: { map: (arg0: (v: any) => any[]) => Iterable<readonly [PropertyKey, any]>; reduce: (arg0: (sum: any, v: any) => any, arg1: number) => any; }) {
  // Map views/visits by app uuid
  const viewsByApp = Object.fromEntries(views.map(v => [v.uuid, v.views]));
  const visitsByApp = Object.fromEntries(visits.map(v => [v.uuid, v.visits]));
  // Calculate totals
  const totalViews = views.reduce((sum, v) => sum + v.views, 0);
  const totalVisits = visits.reduce((sum, v) => sum + v.visits, 0);

  // Merge stats
  return apps.map(app => ({
    ...app,
    views: viewsByApp[app.uuid] || 0,
    visits: visitsByApp[app.uuid] || 0,
    viewsPct: totalViews ? ((viewsByApp[app.uuid] || 0) / totalViews) * 100 : 0,
    visitsPct: totalVisits ? ((visitsByApp[app.uuid] || 0) / totalVisits) * 100 : 0,
  }));
}

export default function ApplicationsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [views, setViews] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [cacheClearing, setCacheClearing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('📊 Fetching applications data with cache-busting parameter');
      const { apps, views, visits } = await fetchData(Date.now().toString());
      const calculatedStats = getAppStats(apps, views, visits);

      setApps(apps);
      setViews(views);
      setVisits(visits);
      setStats(calculatedStats);

      console.log('✅ Applications data loaded successfully');
    } catch (err) {
      console.error('❌ Failed to load applications data:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching data';
      setError(errorMessage);
    } finally {
      setLoading(false);
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
        await loadData();
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

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Application Views & Visits</h1>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 rounded-md font-semibold text-sm transition-colors duration-150 text-white bg-cardinal-red hocus:bg-black disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>

          <button
            type="button"
            onClick={clearCache}
            disabled={cacheClearing || loading}
            className="px-4 py-2 rounded-md font-semibold text-sm transition-colors duration-150 text-white bg-gray-600 hocus:bg-gray-800 disabled:opacity-50"
          >
            {cacheClearing ? 'Clearing...' : 'Clear Cache'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="text-lg font-semibold text-blue-600">Loading applications data...</div>
        </div>
      )}

      {error && (
        <div className="text-center py-8">
          <div className="text-lg font-semibold text-red-600">Error: {error}</div>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && stats.length > 0 && (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-2 py-1">Application</th>
              <th className="border px-2 py-1">UUID</th>
              <th className="border px-2 py-1">Views</th>
              <th className="border px-2 py-1">% of Views</th>
              <th className="border px-2 py-1">Visits</th>
              <th className="border px-2 py-1">% of Visits</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(app => (
              <tr key={app.uuid}>
                <td className="border px-2 py-1">{app.name}</td>
                <td className="border px-2 py-1 font-mono">{app.uuid}</td>
                <td className="border px-2 py-1 text-right">{app.views.toLocaleString()}</td>
                <td className="border px-2 py-1 text-right">{app.viewsPct.toFixed(1)}%</td>
                <td className="border px-2 py-1 text-right">{app.visits.toLocaleString()}</td>
                <td className="border px-2 py-1 text-right">{app.visitsPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && stats.length === 0 && (
        <div className="text-center py-8">
          <div className="text-lg text-gray-600">No application data found</div>
        </div>
      )}
    </div>
  );
}