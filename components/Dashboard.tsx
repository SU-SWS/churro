'use client';

import { useState, useEffect } from 'react';
import { VisitsData, ViewsData, Application } from '@/lib/acquia-api-fixed';
import VisitsPieChart from './VisitsPieChart';
import ViewsPieChart from './ViewsPieChart';
import VisitsBarChart from './VisitsBarChart';
import ViewsBarChart from './ViewsBarChart';
import LoadingSpinner from './LoadingSpinner';
import CountUpTimer from './CountUpTimer';
import DataTable from './DataTable';

const Dashboard: React.FC = () => {
  const [visitsData, setVisitsData] = useState<VisitsData[]>([]);
  const [viewsData, setViewsData] = useState<ViewsData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionUuid, setSubscriptionUuid] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loadingStep, setLoadingStep] = useState('');
  const [fetchStats, setFetchStats] = useState<{visits?: number, views?: number}>({});
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationMap, setApplicationMap] = useState<Record<string, string>>({});

  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/acquia/applications');
      if (!response.ok) {
        console.error('Failed to fetch applications');
        return;
      }

      const apps = await response.json();
      console.log('📱 Fetched applications:', apps.length);

      setApplications(apps);

      // Create a mapping of UUID to name
      const appMap: Record<string, string> = {};
      apps.forEach((app: Application) => {
        appMap[app.uuid] = app.name;
      });

      setApplicationMap(appMap);
      console.log('📱 Created application map with', Object.keys(appMap).length, 'entries');

    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchData = async () => {
    if (!subscriptionUuid) {
      setError('Please provide Subscription UUID');
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingStep('Preparing API requests...');
    setFetchStats({});
    setVisitsData([]);
    setViewsData([]);
    setElapsedTime(null);

    const startTime = Date.now();

    try {
      const params = new URLSearchParams({
        subscriptionUuid,
        ...(dateFrom && { from: dateFrom }),
        ...(dateTo && { to: dateTo }),
      });

      console.log('🔄 Fetching data with params:', { subscriptionUuid, dateFrom, dateTo });

      // Fetch visits data
      setLoadingStep('Fetching visits data from Acquia API...');
      const visitsResponse = await fetch(`/api/acquia/visits?${params}`);

      if (!visitsResponse.ok) {
        const visitsError = await visitsResponse.text();
        console.error('Visits API Error:', visitsError);
        throw new Error('Failed to fetch visits data from API');
      }

      const visitsResult = await visitsResponse.json();
      console.log('📊 Received visits result with length:', Array.isArray(visitsResult) ? visitsResult.length : 'not an array');
      // Fetch views data
      setLoadingStep('Fetching views data from Acquia API...');
      const viewsResponse = await fetch(`/api/acquia/views?${params}`);

      if (!viewsResponse.ok) {
        const viewsError = await viewsResponse.text();
        console.error('Views API Error:', viewsError);
        throw new Error('Failed to fetch views data from API');
      }

      const viewsResult = await viewsResponse.json();
      console.log('📈 Received views result with length:', Array.isArray(viewsResult) ? viewsResult.length : 'not an array');
      setLoadingStep('Processing data...');

      // Handle different response formats
      const visitsArray = Array.isArray(visitsResult) ? visitsResult :
                        Array.isArray(visitsResult.data) ? visitsResult.data : [];

      const viewsArray = Array.isArray(viewsResult) ? viewsResult :
                       Array.isArray(viewsResult.data) ? viewsResult.data : [];

      // Add application names to the data
      const visitsWithNames = visitsArray.map(visit => ({
        ...visit,
        applicationName: applicationMap[visit.applicationUuid] || visit.applicationName || `App ${visit.applicationUuid.substring(0, 8)}`
      }));

      const viewsWithNames = viewsArray.map(view => ({
        ...view,
        applicationName: applicationMap[view.applicationUuid] || view.applicationName || `App ${view.applicationUuid.substring(0, 8)}`
      }));

      setVisitsData(visitsWithNames);
      setViewsData(viewsWithNames);

      setFetchStats({
        visits: visitsWithNames.length,
        views: viewsWithNames.length
      });

      setLoadingStep('Complete!');
    } catch (err) {
      console.error('❌ Dashboard fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching data';
        setError(errorMessage);
    } finally {
      const endTime = Date.now();
      const timeElapsed = (endTime - startTime) / 1000;
      setElapsedTime(timeElapsed);
      setLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Cloud Hosting Usage Reporting with Recurring Output (CHURRO)</h1>
        <p>Monthly limits are <strong>30,000,000</strong> Views and <strong>9,000,000</strong> Visits.</p>
        {/* Form */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="subscriptionUuid" className="block text-sm font-medium text-gray-700 mb-2">
                Subscription UUID *
              </label>
              <input
                type="text"
                id="subscriptionUuid"
                value={subscriptionUuid}
                onChange={(e) => setSubscriptionUuid(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter subscription UUID"
                disabled={loading}
              />
            </div>
            
            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
            
            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
            onClick={fetchData}
              disabled={loading || !subscriptionUuid}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
            {loading ? 'Fetching Data...' : 'Fetch Analytics Data'}
            </button>
            {loading && (
              <div className="flex items-center space-x-3">
                <CountUpTimer isRunning={loading} />
                <div className="text-blue-600 font-medium">{loadingStep}</div>
              </div>
          )}

          {!loading && elapsedTime !== null && (
              <div className="flex items-center space-x-3">
              <CountUpTimer isRunning={false} finalTime={elapsedTime} />
                <div className="text-green-600 font-medium">Data loaded in {elapsedTime.toFixed(1)} seconds</div>
            </div>
          )}
        </div>

          <p className="mt-2 text-sm text-gray-600">(Note that it can take several minutes to fetch data from the Acquia API.)</p>
              </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner />
            <p className="mt-4 text-blue-600 font-semibold">{loadingStep}</p>
              </div>
            )}
            
        {/* Fetch Statistics */}
        {Object.keys(fetchStats).length > 0 && !loading && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-8">
            <h3 className="text-sm font-medium text-green-800 mb-2">Data Retrieved Successfully</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-green-700">
              {fetchStats.visits !== undefined && (
                <div>✅ Visits: {fetchStats.visits.toLocaleString()} records fetched</div>
              )}
              {fetchStats.views !== undefined && (
                <div>✅ Views: {fetchStats.views.toLocaleString()} records fetched</div>
              )}
            </div>
          </div>
        )}

        {/* Charts - Each in its own row */}
        {!loading && !error && (visitsData.length > 0 || viewsData.length > 0) && (
          <div className="space-y-8">
            {/* Views Pie Chart */}
            {viewsData.length > 0 && (
              <div className="mb-8">
                <ViewsPieChart
                  key={`views-pie-${viewsData.length}`}
                  data={viewsData}
                  applicationMap={applicationMap}
                />
              </div>
        )}

            {/* Visits Pie Chart */}
            {visitsData.length > 0 && (
              <div className="mb-8">
                <VisitsPieChart
                  key={`visits-pie-${visitsData.length}`}
                  data={visitsData}
                  applicationMap={applicationMap}
                />
          </div>
        )}

            {/* Views Bar Chart */}
            {viewsData.length > 0 && (
              <div className="mb-8">
                <ViewsBarChart
                  key={`views-bar-${viewsData.length}`}
                  data={viewsData}
                  applicationMap={applicationMap}
                />
      </div>
            )}

            {/* Visits Bar Chart */}
            {visitsData.length > 0 && (
              <div className="mb-8">
                <VisitsBarChart
                  key={`visits-bar-${visitsData.length}`}
                  data={visitsData}
                  applicationMap={applicationMap}
                />
    </div>
            )}

            {/* Data Tables Section */}
            <div className="mt-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Data Tables</h2>

              {/* Views Data Table */}
              {viewsData.length > 0 && (
                <DataTable
                  title="Views by Application"
                  data={Object.values(viewsData.reduce((acc, item) => {
                    const appKey = item.applicationUuid;
                    const appName = applicationMap[appKey] || item.applicationName || `App ${appKey.substring(0, 8)}`;

                    if (!acc[appKey]) {
                      acc[appKey] = {
                        name: appName,
                        value: 0,
                        uuid: appKey
                      };
                    }

                    acc[appKey].value += item.views || 0;
                    return acc;
                  }, {} as Record<string, {name: string, value: number, uuid: string}>)).sort((a, b) => b.value - a.value)}
                  valueLabel="Views"
                />
              )}

              {/* Visits Data Table */}
              {visitsData.length > 0 && (
                <DataTable
                  title="Visits by Application"
                  data={Object.values(visitsData.reduce((acc, item) => {
                    const appKey = item.applicationUuid;
                    const appName = applicationMap[appKey] || item.applicationName || `App ${appKey.substring(0, 8)}`;

                    if (!acc[appKey]) {
                      acc[appKey] = {
                        name: appName,
                        value: 0,
                        uuid: appKey
                      };
                    }

                    acc[appKey].value += item.visits || 0;
                    return acc;
                  }, {} as Record<string, {name: string, value: number, uuid: string}>)).sort((a, b) => b.value - a.value)}
                  valueLabel="Visits"
                />
              )}
            </div>
          </div>
        )}

        {/* No Data Message */}
        {!loading && !error && visitsData.length === 0 && viewsData.length === 0 && subscriptionUuid && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
            <p className="mt-1 text-sm text-gray-500">
              No analytics data was found for the specified subscription and date range.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
