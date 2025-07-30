'use client';

import { useState } from 'react';
import { VisitsData, ViewsData } from '@/lib/acquia-api-fixed';
import VisitsPieChart from './VisitsPieChart';
import ViewsBarChart from './ViewsBarChart';
import LoadingSpinner from './LoadingSpinner';

interface ApiResponse {
  data: any[];
  totalItems: number;
  message?: string;
}

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
  const fetchData = async () => {
    if (!subscriptionUuid) {
      setError('Please provide Subscription UUID');
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingStep('Preparing paginated requests...');
    setFetchStats({});

    try {
      const params = new URLSearchParams({
        subscriptionUuid,
        ...(dateFrom && { from: dateFrom }),
        ...(dateTo && { to: dateTo }),
      });

      console.log('🔄 Fetching paginated data with params:', { subscriptionUuid, dateFrom, dateTo });

      // Fetch visits data
      setLoadingStep('Fetching all visits data (paginated)...');
      const visitsResponse = await fetch(`/api/acquia/visits?${params}`);

      if (!visitsResponse.ok) {
        const visitsError = await visitsResponse.text();
        console.error('Visits API Error:', visitsError);
        throw new Error('Failed to fetch visits data from API');
      }

      const visitsResult: ApiResponse = await visitsResponse.json();
      console.log('📊 Received visits result:', visitsResult);

      // Fetch views data
      setLoadingStep('Fetching all views data (paginated)...');
      const viewsResponse = await fetch(`/api/acquia/views?${params}`);

      if (!viewsResponse.ok) {
        const viewsError = await viewsResponse.text();
        console.error('Views API Error:', viewsError);
        throw new Error('Failed to fetch views data from API');
      }

      const viewsResult: ApiResponse = await viewsResponse.json();
      console.log('📈 Received views result:', viewsResult);

      setLoadingStep('Processing all collected data...');

      // Handle both old format (direct array) and new format (with data property)
      const visitsArray = Array.isArray(visitsResult) ? visitsResult : (visitsResult.data || []);
      const viewsArray = Array.isArray(viewsResult) ? viewsResult : (viewsResult.data || []);

      setVisitsData(visitsArray);
      setViewsData(viewsArray);

      setFetchStats({
        visits: visitsResult.totalItems || visitsArray.length,
        views: viewsResult.totalItems || viewsArray.length
      });
      setLoadingStep('Complete!');
    } catch (err) {
      console.error('❌ Dashboard fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching data';
        setError(errorMessage);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Cloud Hosting Usage Reporting with Recurring Output (CHURRO)</h1>
        <p className="text-gray-600 mb-6">Automatically fetches data from the Acquia API. Monthly limits: <strong>30,000,000</strong> Views and <strong>9,000,000</strong> Visits.</p>
        
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

            <button
            onClick={fetchData}
              disabled={loading || !subscriptionUuid}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
            {loading ? 'Fetching All Pages...' : 'Fetch All Analytics Data'}
            </button>

          {!subscriptionUuid && (
            <p className="text-sm text-gray-500 mt-2">
              * Subscription UUID is required to fetch data
            </p>
          )}

          {loading && loadingStep && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Status:</span> {loadingStep}
            </p>
              <p className="text-xs text-blue-600 mt-1">
                Automatically handling pagination to get all available data...
              </p>
        </div>
                )}
              </div>

        {/* Fetch Statistics */}
        {Object.keys(fetchStats).length > 0 && !loading && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-8">
            <h3 className="text-sm font-medium text-green-800 mb-2">Fetch Complete!</h3>
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
        {loading && <LoadingSpinner />}

        {/* Charts */}
        {!loading && !error && (visitsData.length > 0 || viewsData.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {visitsData.length > 0 && (
              <div>
                <VisitsPieChart data={visitsData} />
              </div>
            )}
            
            {viewsData.length > 0 && (
              <div>
                <ViewsBarChart data={viewsData} />
              </div>
            )}
          </div>
        )}

        {/* Data Summary */}
        {!loading && !error && (visitsData.length > 0 || viewsData.length > 0) && (
          <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Complete Dataset Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Visits Records (All Pages):</p>
                <p className="text-2xl font-bold text-blue-600">{visitsData.length.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Views Records (All Pages):</p>
                <p className="text-2xl font-bold text-green-600">{viewsData.length.toLocaleString()}</p>
              </div>
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
              No analytics data was found for the specified subscription and date range across all pages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;