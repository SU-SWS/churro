'use client';

import React, { useState, useEffect } from 'react';
import { VisitsData, ViewsData, Application } from '@/lib/acquia-api';
import VisitsPieChart from './VisitsPieChart';
import ViewsPieChart from './ViewsPieChart';
import SimpleVisitsBarChart from './SimpleVisitsBarChart';
import SimpleViewsBarChart from './SimpleViewsBarChart';
import CountUpTimer from './CountUpTimer';
import DataTable from './DataTable';

const TABS = [
  { label: 'Views Pie Chart', key: 'views-pie' },
  { label: 'Views Bar Chart', key: 'views-bar' },
  { label: 'Visits Pie Chart', key: 'visits-pie' },
  { label: 'Visits Bar Chart', key: 'visits-bar' },
  { label: 'Views Table', key: 'views-table' },
  { label: 'Visits Table', key: 'visits-table' },
];


const DEFAULT_SUBSCRIPTION_UUID = process.env.NEXT_PUBLIC_ACQUIA_SUBSCRIPTION_UUID || "";

const Dashboard: React.FC = () => {
  const monthlyVisitsEntitlement = parseInt(process.env.NEXT_PUBLIC_ACQUIA_MONTHLY_VISITS_ENTITLEMENT || '9000000', 10);
  const monthlyViewsEntitlement = parseInt(process.env.NEXT_PUBLIC_ACQUIA_MONTHLY_VIEWS_ENTITLEMENT || '30000000', 10);

  const [visitsData, setVisitsData] = useState<VisitsData[]>([]);
  const [viewsData, setViewsData] = useState<ViewsData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionUuid, setSubscriptionUuid] = useState(DEFAULT_SUBSCRIPTION_UUID);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loadingStep, setLoadingStep] = useState('');
  const [fetchStats, setFetchStats] = useState<{visits?: number, views?: number}>({});
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationMap, setApplicationMap] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [data, setData] = useState<{
    visits: VisitsData[];
    views: ViewsData[];
    totalVisits: number;
    totalViews: number;
    dateRange: { from: string; to: string };
  } | null>(null);

  const fetchApplications = async () => {
    if (!subscriptionUuid) return;

    try {
      console.log('📱 Fetching applications for subscription:', subscriptionUuid);
      const response = await fetch(`/api/acquia/applications?subscriptionUuid=${subscriptionUuid}`);
      if (!response.ok) {
        console.error('Failed to fetch applications:', response.status);
        return;
      }

      const apps = await response.json();
      console.log('📱 Fetched applications:', apps.length, apps);

      setApplications(apps);

      // Create a mapping of UUID to name
      const appMap: Record<string, string> = {};
      apps.forEach((app: Application) => {
        appMap[app.uuid] = app.name;
      });

      setApplicationMap(appMap);
      console.log('📱 Created application map:', appMap);

    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  // Add a function to check environment variables
  const   checkEnvironmentVars = async () => {
    try {
      const response = await fetch('/api/check-env');
      const data = await response.json();
      // console.log('Environment variables check:', data);
      alert(`API Key in .env.local: ${data.env_file.parsed_values.ACQUIA_API_KEY}\nAPI Key in process.env: ${data.process_env.ACQUIA_API_KEY}\nExact match: ${data.comparison.exact_match.ACQUIA_API_KEY}`);
    } catch (error) {
      console.error('Error checking environment variables:', error);
    }
  };

  useEffect(() => {
    if (subscriptionUuid) {
      fetchApplications();
    }
  }, [subscriptionUuid]);

  const fetchData = async () => {
    if (!subscriptionUuid) {
      setError('No subscription UUID available');
      return;
    }

    setLoading(true);
    setError(null);
    // Reset individual state instead of setData(null)
    setVisitsData([]);
    setViewsData([]);
    setFetchStats({});

    try {
      // Get current cache buster from server
      let cacheBuster = '';
      try {
        const cbResponse = await fetch('/api/cache-buster');
        if (cbResponse.ok) {
          const cbData = await cbResponse.json();
          cacheBuster = cbData.cacheBuster || '';
        }
      } catch (error) {
        console.warn('Failed to get cache buster:', error);
      }

      console.log('🔍 Using cache buster:', cacheBuster);

      // Build query parameters with cache buster if present
      const buildParams = (extraParams: Record<string, string> = {}) => {
        const params = new URLSearchParams({
          subscriptionUuid,
          ...(dateFrom && { from: dateFrom }),
          ...(dateTo && { to: dateTo }),
          ...extraParams
        });

        // Add cache buster if we have one
        if (cacheBuster) {
          params.set('_cb', cacheBuster);
        }

        return params;
      };

      // Fetch visits data
      setLoadingStep('Fetching visits data from Acquia API...');
      const visitsParams = buildParams();
      console.log('🌐 Visits API call:', `/api/acquia/visits?${visitsParams}`);
      const visitsResponse = await fetch(`/api/acquia/visits?${visitsParams}`);

      if (!visitsResponse.ok) {
        throw new Error(`Visits API error: ${visitsResponse.status} ${visitsResponse.statusText}`);
      }

      const visitsData = await visitsResponse.json();
      console.log('📊 Visits data received:', visitsData.totalItems, 'items');

      // Fetch views data
      setLoadingStep('Fetching views data from Acquia API...');
      const viewsParams = buildParams();
      console.log('🌐 Views API call:', `/api/acquia/views?${viewsParams}`);
      const viewsResponse = await fetch(`/api/acquia/views?${viewsParams}`);

      if (!viewsResponse.ok) {
        throw new Error(`Views API error: ${viewsResponse.status} ${viewsResponse.statusText}`);
      }

      const viewsData = await viewsResponse.json();
      console.log('📊 Views data received:', viewsData.totalItems, 'items');

      // Process and set data using individual setters
      setVisitsData(visitsData.data || []);
      setViewsData(viewsData.data || []);
      setFetchStats({
        visits: visitsData.totalItems || 0,
        views: viewsData.totalItems || 0
      });

      console.log('✅ Data fetch completed successfully');
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Summarize and sort visits by application for the month
  const visitsSummary = React.useMemo(() => {
    const summary: Record<string, { name: string; visits: number; uuid: string }> = {};
    visitsData.forEach(item => {
      const key = item.applicationUuid || 'unknown';
      const name =
        applicationMap[key] ||
        item.applicationName ||
        (key !== 'unknown' ? `App ${key.substring(0, 8)}` : 'Unknown App');
      if (!summary[key]) {
        summary[key] = { name, visits: 0, uuid: key };
      }
      summary[key].visits += typeof item.visits === 'number' ? item.visits : 0;
    });
    // Sort by visits in descending order
    return Object.values(summary)
      .filter(app => app.visits > 0)
      .sort((a, b) => b.visits - a.visits);
  }, [visitsData, applicationMap]);

  // Summarize and sort views by application for the month
  const viewsSummary = React.useMemo(() => {
    const summary: Record<string, { name: string; views: number; uuid: string }> = {};
    viewsData.forEach(item => {
      const key = item.applicationUuid || 'unknown';
      const name =
        applicationMap[key] ||
        item.applicationName ||
        (key !== 'unknown' ? `App ${key.substring(0, 8)}` : 'Unknown App');
      if (!summary[key]) {
        summary[key] = { name, views: 0, uuid: key };
      }
      summary[key].views += typeof item.views === 'number' ? item.views : 0;
    });
    // Sort by views in descending order
    return Object.values(summary)
      .filter(app => app.views > 0)
      .sort((a, b) => b.views - a.views);
  }, [viewsData, applicationMap]);

  const clearCache = async () => {
    setCacheClearing(true);
    try {
      console.log('🗑️ Attempting to clear cache...');

      const response = await fetch('/api/cache', { method: 'DELETE' });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Server cache cleared:', result);
        console.log('🔍 Full response object:', JSON.stringify(result, null, 2));

        const environment = result.environment || 'unknown';
        const method = result.method || 'unknown';
        const cacheBuster = result.cacheBuster || 'none';

        alert(`Cache cleared successfully!\nEnvironment: ${environment}\nMethod: ${method}\nCache Buster: ${cacheBuster}`);

        // Immediately check what cache buster we get now
        try {
          const cbResponse = await fetch('/api/cache-buster');
          if (cbResponse.ok) {
            const cbData = await cbResponse.json();
            console.log('🔍 Cache buster after clear:', cbData.cacheBuster);
          }
        } catch (error) {
          console.warn('Failed to check cache buster after clear:', error);
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
    <div className="min-h-screen p-8">
      <header className="mb-8 text-center">
        <div className="mt-2 text-black text-lg">
          This dashboard shows your monthly usage for Acquia Cloud hosting.<br />
          <span className="text-cardinal-red font-semibold">
            Monthly limits: {monthlyVisitsEntitlement.toLocaleString()} visits and {monthlyViewsEntitlement.toLocaleString()} views.
          </span>
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
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
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
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none"
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-col items-center my-8 gap-8">
            <button
              type="button"
              onClick={fetchData}
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
          </div>

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

          <p className="text-base text-black-60 font-semibold">
            (Note that it can take several minutes to fetch data from the Acquia API.)
          </p>

        </form>
      </div>
      {/* Per-Application Links */}
      <section className="mb-8 max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6 border border-gray-400">
          <h2 className="text-xl font-semibold mb-4 text-center">
            Per-Application Reporting
          </h2>
          <ul className="flex flex-row flex-wrap justify-center gap-4 list-none list-inside text-black-80">
          <li className="text-base py-2 px-6"><a href="/applications/3e02ea73-76fa-4a88-91d7-3476aca3cf07">BOT Gryphon</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/f195d4d2-7ed4-428a-abc0-a630c9a70e23">CASBS</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/6ff80a79-24f4-4ded-9021-71e55ba1427b">Fingate</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/d56bf9c2-20e0-4c42-8f42-dc9fa57343bc">fshgryphon</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/60ee2ebb-94f3-415d-a289-c23889ecec18">HumSci Gryphon</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/a840b27a-157c-4831-867a-56763306d293">HR Gryphon</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/12c62419-8d5c-40e1-b7ab-f7999e0cc3e9">Lagunita</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/f7e9fc1b-062d-4ed8-baf7-ae33551f8934">SDSS Gryphon</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/db2ae944-e598-4cfb-bab2-0b039db76f4d">SOE Gryphon</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/8449683b-500e-4728-b70a-5f69d9e8a61a">Stanford Gryphon</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/12c8cc84-af7e-470d-b356-e881e4da546d">stanfordfsh</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/0f307beb-65b3-4ee4-8b09-1020ca64b482">stanfordgse</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/4283bcea-8746-4c70-a4b5-52a9b662c954">stanfordhumanitiesctr</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/7da3734d-5f1d-4cac-92ef-8dcf9ae3c526">stanfordrde2</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/eed9a501-bc72-4e69-8d48-82e211f15f5a">stanfordvpge</a></li>
          <li className="text-base py-2 px-6"><a href="/applications/4207734d-7ccd-4a06-8426-4108761c3e10">Summer</a></li>
          </ul>
      </section>

      {/* Tabs */}
      <div className="pt-15 flex flex-wrap gap-2 justify-center border-b border-gray-400">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 text-lg py-2 rounded-t font-semibold border border-b-0 border-gray-400 transition-colors duration-150 ${
              activeTab === tab.key
                ? 'border-cardinal-red text-white bg-cardinal-red'
                : 'text-black bg-gray-100 hocus:bg-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg p-4 border border-t-0 border-gray-400 mb-50">
        {activeTab === 'views-pie' && (
          <ViewsPieChart data={viewsSummary.map(app => ({ name: app.name, value: app.views, uuid: app.uuid }))} />
        )}
        {activeTab === 'views-bar' && (
          <SimpleViewsBarChart data={viewsSummary.map(app => ({ name: app.name, value: app.views, uuid: app.uuid }))} />
        )}
        {activeTab === 'visits-pie' && (
          <VisitsPieChart data={visitsSummary.map(app => ({ name: app.name, value: app.visits, uuid: app.uuid }))} />
        )}
        {activeTab === 'visits-bar' && (
          <SimpleVisitsBarChart data={visitsSummary.map(app => ({ name: app.name, value: app.visits, uuid: app.uuid }))} />
        )}
        {activeTab === 'views-table' && (
          <DataTable
            title="Views (Monthly Summary by Application)"
            data={viewsSummary.map((app, index) => ({
              rank: index + 1,
              name: app.name,
              value: app.views,
              uuid: app.uuid,
            }))}
            valueLabel="Views"
            total={viewsSummary.reduce((sum, app) => sum + app.views, 0)}
          />
        )}
        {activeTab === 'visits-table' && (
          <DataTable
            title="Visits (Monthly Summary by Application)"
            data={visitsSummary.map((app, index) => ({
              rank: index + 1,
              name: app.name,
              value: app.visits,
              uuid: app.uuid,
            }))}
            valueLabel="Visits"
            total={visitsSummary.reduce((sum, app) => sum + app.visits, 0)}
          />
        )}
      </div>
      {/* ...loading and error messages... */}

      {/* Debug Info - Only visible in development mode */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 rounded">
          <h3 className="font-bold">Debug Info</h3>
          <pre className="text-xs mt-2">
            {JSON.stringify({
              subscriptionUuid,
              applicationMapSize: Object.keys(applicationMap || {}).length,
              applicationsLength: applications?.length || 0,
              visitsDataLength: visitsData?.length || 0,
              viewsDataLength: viewsData?.length || 0,
              hasError: !!error,
              loading,
              dateFrom,
              dateTo,
              fetchStats,
              cacheInfo: {
                requestUrl: `/api/acquia/visits?subscriptionUuid=${subscriptionUuid}&from=${dateFrom}&to=${dateTo}`,
                requestCount: Math.floor(Date.now() / 1000) % 100, // Simple request counter
              }
            }, null, 2)}
          </pre>
          <button
            onClick={() => {
              console.log('🗑️ Clearing browser cache');
              if ('caches' in window) {
                caches.keys().then(names => {
                  names.forEach(name => caches.delete(name));
                });
              }
            }}
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded"
          >
            Clear Browser Cache
          </button>
        </div>
      )}
    </div>

  );
};

export default Dashboard;
