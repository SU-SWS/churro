'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CountUpTimer from '@/components/CountUpTimer';

// Helper function to get previous month date range
function getPreviousMonthRange() {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Format dates as YYYY-MM-DD
  const from = previousMonth.toISOString().split('T')[0];
  const to = lastDayOfPreviousMonth.toISOString().split('T')[0];

  // Get formatted month name for display
  const monthName = previousMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  return { from, to, monthName };
}

interface Application {
  uuid: string;
  name: string;
}

interface AppStats extends Application {
  views: number;
  visits: number;
  viewsPct: number;
  visitsPct: number;
}

interface User {
  sunetId?: string;
  email?: string;
}

function getAppStats(apps: Application[], views: any[], visits: any[]): AppStats[] {
  // Aggregate views/visits by app uuid (sum across all dates)
  const viewsByApp: Record<string, number> = {};
  const visitsByApp: Record<string, number> = {};

  // Ensure views and visits are arrays
  const viewsArray = Array.isArray(views) ? views : [];
  const visitsArray = Array.isArray(visits) ? visits : [];

  console.log('🔍 Processing views data:', viewsArray.length, 'items');
  console.log('🔍 Processing visits data:', visitsArray.length, 'items');
  if (viewsArray.length > 0) {
    console.log('📊 Sample views item:', JSON.stringify(viewsArray[0], null, 2));
    console.log('📊 Views item keys:', Object.keys(viewsArray[0]));
  }
  if (visitsArray.length > 0) {
    console.log('📊 Sample visits item:', JSON.stringify(visitsArray[0], null, 2));
    console.log('📊 Visits item keys:', Object.keys(visitsArray[0]));
  }

  viewsArray.forEach((v, index) => {
    const uuid = v.applicationUuid;
    const viewCount = v.views || 0;
    if (index < 3) {
      console.log(`📈 Processing views item ${index}:`, { uuid, viewCount, hasUuid: !!uuid, hasViews: !!v.views, item: JSON.stringify(v, null, 2) });
    }
    if (uuid && viewCount > 0) {
      viewsByApp[uuid] = (viewsByApp[uuid] || 0) + viewCount;
      console.log(`📈 Views accumulated: ${uuid} = ${viewsByApp[uuid]} (added ${viewCount})`);
    }
  });

  visitsArray.forEach((v, index) => {
    const uuid = v.applicationUuid;
    const visitCount = v.visits || 0;
    if (index < 3) {
      console.log(`👥 Processing visits item ${index}:`, { uuid, visitCount, hasUuid: !!uuid, hasVisits: !!v.visits, item: JSON.stringify(v, null, 2) });
    }
    if (uuid && visitCount > 0) {
      visitsByApp[uuid] = (visitsByApp[uuid] || 0) + visitCount;
      console.log(`👥 Visits accumulated: ${uuid} = ${visitsByApp[uuid]} (added ${visitCount})`);
    }
  });

  // Calculate totals
  const totalViews = Object.values(viewsByApp).reduce((sum, v) => sum + v, 0);
  const totalVisits = Object.values(visitsByApp).reduce((sum, v) => sum + v, 0);

  console.log('📊 Aggregated views by app:', JSON.stringify(viewsByApp, null, 2));
  console.log('📊 Aggregated visits by app:', JSON.stringify(visitsByApp, null, 2));
  console.log('📊 Total views:', totalViews);
  console.log('📊 Total visits:', totalVisits);
  console.log('📊 Apps to process:', apps.map(a => `${a.name} (${a.uuid})`));

  // Merge stats
  const result = apps.map(app => ({
    ...app,
    views: viewsByApp[app.uuid] || 0,
    visits: visitsByApp[app.uuid] || 0,
    viewsPct: totalViews ? ((viewsByApp[app.uuid] || 0) / totalViews) * 100 : 0,
    visitsPct: totalVisits ? ((visitsByApp[app.uuid] || 0) / totalVisits) * 100 : 0,
  }));

  console.log('📈 Final stats for apps:', result.map(r => `${r.name}: ${r.views} views, ${r.visits} visits`));
  return result;
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<AppStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthName, setMonthName] = useState('');
  const [loadTime, setLoadTime] = useState<number | null>(null);

  // Check authentication and load applications first
  useEffect(() => {
    async function checkAuthAndLoadApps() {
      try {
        // Check authentication
        const authResponse = await fetch('/api/auth/status');
        if (!authResponse.ok) {
          router.push('/api/saml/login');
          return;
        }

        const { authenticated, user: userData } = await authResponse.json();
        if (!authenticated) {
          router.push('/api/saml/login');
          return;
        }

        setUser(userData);

        // Get month name
        const { monthName: currentMonthName } = getPreviousMonthRange();
        setMonthName(currentMonthName);

        // Load applications quickly first
        const appsResponse = await fetch('/api/acquia/applications');
        if (!appsResponse.ok) {
          throw new Error(`Failed to load applications: ${appsResponse.status}`);
        }

        const appsData = await appsResponse.json();

        // Filter out excluded UUIDs and apply user permissions
        const excludedUuids = ['2b2d2517-3839-414e-85a4-7183adc22283', '1ef402a7-c301-42d7-9b63-f226fa1b2329'];
        const filteredApps = appsData.filter((app: Application) => !excludedUuids.includes(app.uuid));

        // Sort applications alphabetically by name
        const sortedApps = filteredApps.sort((a: Application, b: Application) =>
          a.name.localeCompare(b.name)
        );

        setApplications(sortedApps);

        // Initialize stats with just application info (no metrics yet)
        const initialStats: AppStats[] = sortedApps.map((app: Application) => ({
          ...app,
          views: 0,
          visits: 0,
          viewsPct: 0,
          visitsPct: 0,
        }));
        setStats(initialStats);
        setLoading(false);

        // Now start loading the metrics data with timer
        setLoadingMetrics(true);
        await loadMetricsData(sortedApps);

      } catch (err) {
        console.error('Error loading applications:', err);
        setError(err instanceof Error ? err.message : 'Failed to load applications');
        setLoading(false);
      }
    }

    checkAuthAndLoadApps();
  }, [router]);

  async function loadMetricsData(apps: Application[]) {
    const startTime = Date.now();

    try {
      const { from, to } = getPreviousMonthRange();
      const subscriptionUuid = process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID;

      // Fetch views and visits data with retry logic for 503 errors
      const fetchWithRetry = async (url: string, retries = 3): Promise<Response> => {
        for (let i = 0; i < retries; i++) {
          const response = await fetch(url);

          if (response.status === 503) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            continue;
          }

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
          }

          return response;
        }
        throw new Error('Service temporarily unavailable (503). Please try again later.');
      };

      const [viewsResponse, visitsResponse] = await Promise.all([
        fetchWithRetry(`/api/acquia/views?subscriptionUuid=${subscriptionUuid}&from=${from}&to=${to}`),
        fetchWithRetry(`/api/acquia/visits?subscriptionUuid=${subscriptionUuid}&from=${from}&to=${to}`)
      ]);

      const [viewsData, visitsData] = await Promise.all([
        viewsResponse.json(),
        visitsResponse.json()
      ]);

      console.log('🌐 Raw views API response:', {
        type: typeof viewsData,
        isArray: Array.isArray(viewsData),
        length: viewsData?.length,
        keys: viewsData && typeof viewsData === 'object' ? Object.keys(viewsData) : 'N/A',
        sample: viewsData
      });

      console.log('🌐 Raw visits API response:', {
        type: typeof visitsData,
        isArray: Array.isArray(visitsData),
        length: visitsData?.length,
        keys: visitsData && typeof visitsData === 'object' ? Object.keys(visitsData) : 'N/A',
        sample: visitsData
      });

      // Handle different response formats - API routes wrap data in { data: [...] }
      const viewsArray = Array.isArray(viewsData) ? viewsData :
                        Array.isArray(viewsData.data) ? viewsData.data : [];

      const visitsArray = Array.isArray(visitsData) ? visitsData :
                         Array.isArray(visitsData.data) ? visitsData.data : [];

      console.log('🔧 Extracted arrays:', {
        viewsLength: viewsArray.length,
        visitsLength: visitsArray.length
      });

      // Calculate final stats
      const finalStats = getAppStats(apps, viewsArray, visitsArray);
      setStats(finalStats);

      const endTime = Date.now();
      setLoadTime((endTime - startTime) / 1000);
      setLoadingMetrics(false);

    } catch (err) {
      console.error('Error loading metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load metrics data');
      setLoadingMetrics(false);
    }
  }

  if (loading) {
    return (
      <div className="px-20 sm:px-30 md:px-50 lg:px-30 py-30">
        <h1 className="type-1 mb-20">Application Views & Visits</h1>
        <div className="text-center py-50">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cardinal-red mx-auto mb-15"></div>
          <p className="text-black-60">Loading applications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-20 sm:px-30 md:px-50 lg:px-30 py-30">
        <h1 className="type-1 mb-20">Application Views & Visits ({monthName})</h1>
        <div className="bg-cardinal-red-light border border-cardinal-red rounded-md p-20">
          <h3 className="type-3 text-cardinal-red mb-10">Error Loading Data</h3>
          <p className="text-cardinal-red mb-15">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-cardinal-red text-white px-20 py-10 rounded hocus:bg-cardinal-red-dark"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="px-20 sm:px-30 md:px-50 lg:px-30 py-30">
        <h1 className="type-1 mb-20">Application Views & Visits ({monthName})</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-20">
          <h3 className="type-3 text-yellow-800 mb-10">No Applications Available</h3>
          <p className="text-yellow-700 mb-10">
            You don't have access to any applications. Contact your administrator if you believe this is an error.
          </p>
          <p className="text-sm text-yellow-600">
            Logged in as: {user?.sunetId || user?.email || 'Unknown user'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-20 sm:px-30 md:px-50 lg:px-30 py-30">
      <h1 className="type-1 mb-20">Application Views & Visits ({monthName})</h1>

      {loadingMetrics && (
        <div className="mb-20">
          <div className="text-center mb-15">
            <p className="text-black-60 mb-10">Loading usage metrics...</p>
            <CountUpTimer isRunning={loadingMetrics} finalTime={loadTime} />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-black-20">
          <thead>
            <tr className="bg-black-10">
              <th className="border border-black-20 px-15 py-10 text-left font-semibold">Application</th>
              <th className="border border-black-20 px-15 py-10 text-left font-semibold">UUID</th>
              <th className="border border-black-20 px-15 py-10 text-right font-semibold">Views</th>
              <th className="border border-black-20 px-15 py-10 text-right font-semibold">% of Views</th>
              <th className="border border-black-20 px-15 py-10 text-right font-semibold">Visits</th>
              <th className="border border-black-20 px-15 py-10 text-right font-semibold">% of Visits</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(app => (
              <tr key={app.uuid} className="hocus:bg-black-10">
                <td className="border border-black-20 px-15 py-10">
                  <Link
                    href={`/applications/${app.uuid}`}
                    className="text-digital-blue hocus:text-cardinal-red hocus:underline"
                  >
                    {app.name}
                  </Link>
                </td>
                <td className="border border-black-20 px-15 py-10">
                  <Link
                    href={`/applications/${app.uuid}`}
                    className="font-mono text-sm text-digital-blue hocus:text-cardinal-red hocus:underline"
                  >
                    {app.uuid}
                  </Link>
                </td>
                <td className="border border-black-20 px-15 py-10 text-right font-mono">
                  {loadingMetrics ? (
                    <span className="text-black-40">Loading...</span>
                  ) : (
                    app.views.toLocaleString()
                  )}
                </td>
                <td className="border border-black-20 px-15 py-10 text-right font-mono">
                  {loadingMetrics ? (
                    <span className="text-black-40">—</span>
                  ) : (
                    `${app.viewsPct.toFixed(1)}%`
                  )}
                </td>
                <td className="border border-black-20 px-15 py-10 text-right font-mono">
                  {loadingMetrics ? (
                    <span className="text-black-40">Loading...</span>
                  ) : (
                    app.visits.toLocaleString()
                  )}
                </td>
                <td className="border border-black-20 px-15 py-10 text-right font-mono">
                  {loadingMetrics ? (
                    <span className="text-black-40">—</span>
                  ) : (
                    `${app.visitsPct.toFixed(1)}%`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}