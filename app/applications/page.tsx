import React from 'react';

// Force dynamic rendering - don't try to pre-render at build time
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_BASE_URL
    ? process.env.NEXT_PUBLIC_BASE_URL
    : 'http://localhost:3000';

async function fetchData() {
  const [appsRes, viewsRes, visitsRes] = await Promise.all([
    fetch(`${BASE_URL}/api/acquia/applications`),
    fetch(`${BASE_URL}/api/acquia/views`),
    fetch(`${BASE_URL}/api/acquia/visits`),
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

export default async function ApplicationsPage() {
  const { apps, views, visits } = await fetchData();
  const stats = getAppStats(apps, views, visits);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Application Views & Visits</h1>
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
    </div>
  );
}