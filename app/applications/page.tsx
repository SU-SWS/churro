import React from 'react';
import AcquiaApiServiceFixed from '@/lib/acquia-api';
import { getCurrentUser, hasGlobalAccess, hasApplicationAccess } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';

// Force dynamic rendering - don't try to pre-render at build time
export const dynamic = 'force-dynamic';

async function fetchData() {
  // Check authentication first
  const user = await getCurrentUser();
  if (!user) {
    redirect('/api/saml/login');
  }

  // Initialize API service
  const apiService = new AcquiaApiServiceFixed({
    baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
    authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
    apiKey: process.env.ACQUIA_API_KEY!,
    apiSecret: process.env.ACQUIA_API_SECRET!,
  });

  // Fetch all applications first
  const [allApps, views, visits] = await Promise.all([
    apiService.getApplications(),
    apiService.getViewsDataByApplication(process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID!),
    apiService.getVisitsDataByApplication(process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID!),
  ]);

  // Filter applications based on user permissions
  const apps = hasGlobalAccess(user)
    ? allApps || []
    : (allApps || []).filter(app => hasApplicationAccess(user, app.uuid));

  return {
    apps,
    views: views || [],
    visits: visits || [],
    user
  };
}

function getAppStats(apps: any[], views: any[], visits: any[]) {
  // Aggregate views/visits by app uuid (sum across all dates)
  const viewsByApp: Record<string, number> = {};
  const visitsByApp: Record<string, number> = {};

  views.forEach(v => {
    const uuid = v.applicationUuid || v.uuid;
    viewsByApp[uuid] = (viewsByApp[uuid] || 0) + v.views;
  });

  visits.forEach(v => {
    const uuid = v.applicationUuid || v.uuid;
    visitsByApp[uuid] = (visitsByApp[uuid] || 0) + v.visits;
  });

  // Calculate totals
  const totalViews = Object.values(viewsByApp).reduce((sum, v) => sum + v, 0);
  const totalVisits = Object.values(visitsByApp).reduce((sum, v) => sum + v, 0);

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
  const { apps, views, visits, user } = await fetchData();
  const stats = getAppStats(apps, views, visits);

  if (stats.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6">Application Views & Visits</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <h3 className="text-lg font-medium text-yellow-800 mb-2">No Applications Available</h3>
          <p className="text-yellow-700">
            You don't have access to any applications. Contact your administrator if you believe this is an error.
          </p>
          <p className="text-sm text-yellow-600 mt-2">
            Logged in as: {user?.sunetId || user?.email || 'Unknown user'}
          </p>
        </div>
      </div>
    );
  }

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