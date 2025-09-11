import React from 'react';

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_BASE_URL
    ? process.env.NEXT_PUBLIC_BASE_URL
    : 'http://localhost:3000';

interface PageProps {
  params: { uuid: string };
}

async function fetchAppDetail(uuid: string, from: string, to: string) {
  // Fetch all apps (to get the name), and this app's views/visits
  const [appsRes, viewsRes, visitsRes] = await Promise.all([
    fetch(`${BASE_URL}/api/acquia/applications`),
    fetch(`${BASE_URL}/api/acquia/views?from=${from}&to=${to}`),
    fetch(`${BASE_URL}/api/acquia/visits?from=${from}&to=${to}`),
  ]);
  const [apps, viewsRaw, visitsRaw] = await Promise.all([
    appsRes.ok ? appsRes.json() : [],
    viewsRes.ok ? viewsRes.json() : [],
    visitsRes.ok ? visitsRes.json() : [],
  ]);
  const app = Array.isArray(apps) ? apps.find((a: any) => a.uuid === uuid) : null;
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
  const appViews = views.find((v: any) => v.uuid === uuid);
  const appVisits = visits.find((v: any) => v.uuid === uuid);
  const totalViews = views.reduce((sum: number, v: any) => sum + (v.views || 0), 0);
  const totalVisits = visits.reduce((sum: number, v: any) => sum + (v.visits || 0), 0);

  return {
    app,
    views: appViews ? appViews.views : 0,
    visits: appVisits ? appVisits.visits : 0,
    viewsPct: totalViews ? ((appViews ? appViews.views : 0) / totalViews) * 100 : 0,
    visitsPct: totalVisits ? ((appVisits ? appVisits.visits : 0) / totalVisits) * 100 : 0,
    from,
    to,
  };
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  // You can make these dynamic or user-selectable
  const from = '2025-08-01';
  const to = '2025-08-31';

  const { app, views, visits, viewsPct, visitsPct } = await fetchAppDetail(params.uuid, from, to);

  if (!app) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6">Application Not Found</h1>
        <p>No application found with UUID: <span className="font-mono">{params.uuid}</span></p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">{app.name}</h1>
      <div className="mb-4">
        <strong>UUID:</strong> <span className="font-mono">{app.uuid}</span>
      </div>
      <div className="mb-4">
        <strong>Views ({from} to {to}):</strong> {views.toLocaleString()} ({viewsPct.toFixed(1)}%)
      </div>
      <div className="mb-4">
        <strong>Visits ({from} to {to}):</strong> {visits.toLocaleString()} ({visitsPct.toFixed(1)}%)
      </div>
      {/* Add more details or charts here if desired */}
    </div>
  );
}