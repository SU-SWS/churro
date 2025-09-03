'use client';

import React, { useState, useEffect } from 'react';
import { VisitsData, ViewsData, Application } from '@/lib/acquia-api';
import VisitsPieChart from './VisitsPieChart';
import ViewsPieChart from './ViewsPieChart';
import SimpleVisitsBarChart from './SimpleVisitsBarChart';
import SimpleViewsBarChart from './SimpleViewsBarChart';
import CountUpTimer from './CountUpTimer';
import DataTable from './DataTable';

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

  // Add a function to check environment variables
  const   checkEnvironmentVars = async () => {
    try {
      const response = await fetch('/api/check-env');
      const data = await response.json();
      console.log('Environment variables check:', data);
      alert(`API Key in .env.local: ${data.env_file.parsed_values.ACQUIA_API_KEY}\nAPI Key in process.env: ${data.process_env.ACQUIA_API_KEY}\nExact match: ${data.comparison.exact_match.ACQUIA_API_KEY}`);
    } catch (error) {
      console.error('Error checking environment variables:', error);
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
      const visitsWithNames = visitsArray.map((visit: { applicationUuid: string; applicationName: any; }) => ({
        ...visit,
        applicationName: applicationMap[visit.applicationUuid] || visit.applicationName || (visit.applicationUuid ? `App ${visit.applicationUuid.substring(0, 8)}` : 'Unknown App')
      }));

      const viewsWithNames = viewsArray.map((view: { applicationUuid: string; applicationName: any; }) => ({
        ...view,
        applicationName: applicationMap[view.applicationUuid] || view.applicationName || (view.applicationUuid ? `App ${view.applicationUuid.substring(0, 8)}` : 'Unknown App')
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

  return (
    <div
      className="min-h-screen p-8"
      style={{
        backgroundColor: 'var(--stanford-white)',
        fontFamily: 'Source Sans Pro, Arial, sans-serif',
        color: 'var(--stanford-black)',
      }}
    >
      <header className="mb-8 text-center">
        <h1
          className="text-3xl font-bold mb-2"
          style={{
            color: 'var(--stanford-cardinal)',
            fontFamily: 'Source Sans Pro, Arial, sans-serif',
            letterSpacing: '0.05em',
          }}
        >
          Cloud Hosting Usage Reporting with Recurring Output (CHURRO)
        </h1>
        <p className="text-lg" style={{ color: 'var(--stanford-gray)' }}>
          Stanford University IT | Stanford Web Services
        </p>
        <div className="mt-2 text-base" style={{ color: 'var(--stanford-black)' }}>
          This dashboard shows your monthly usage for Acquia Cloud hosting.<br />
          <span style={{ color: 'var(--stanford-cardinal)', fontWeight: 'bold' }}>
            Monthly limits: {monthlyVisitsEntitlement.toLocaleString()} visits and {monthlyViewsEntitlement.toLocaleString()} views.
          </span>
        </div>
      </header>

      <section className="mb-8 max-w-xl mx-auto bg-white rounded-lg shadow-md p-6 border-2" style={{ borderColor: 'var(--stanford-cardinal)' }}>
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
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
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
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
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
              onClick={fetchData}
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

      {/* Data Display Section */}
      <section className="grid grid-cols-1 gap-8">
        {/* Data Tables Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <DataTable
            title="Views (Monthly Summary by Application)"
            data={viewsSummary.map((app, index) => ({
              rank: index + 1,
              name: app.name,
              value: app.views,
              uuid: app.uuid,
            }))}
            valueLabel="Views"
          />
          <DataTable
            title="Visits (Monthly Summary by Application)"
            data={visitsSummary.map((app, index) => ({
              rank: index + 1,
              name: app.name,
              value: app.visits,
              uuid: app.uuid,
            }))}
            valueLabel="Visits"
          />
        </div>

        {/* Views Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-center" style={{ color: 'var(--stanford-cardinal)' }}>
            Views by Application
          </h2>
          <div className="bg-white rounded-lg shadow-md p-4">
            <ViewsPieChart data={viewsSummary.map(app => ({ name: app.name, value: app.views, uuid: app.uuid }))} />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-4 text-center" style={{ color: 'var(--stanford-cardinal)' }}>
            Views by Application
          </h2>
          <div className="bg-white rounded-lg shadow-md p-4">
            <SimpleViewsBarChart data={viewsSummary.map(app => ({ name: app.name, value: app.views, uuid: app.uuid }))} />
          </div>
        </div>

        {/* Visits Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-center" style={{ color: 'var(--stanford-cardinal)' }}>
            Visits by Application
          </h2>
          <div className="bg-white rounded-lg shadow-md p-4">
            <VisitsPieChart data={visitsSummary.map(app => ({ name: app.name, value: app.visits, uuid: app.uuid }))} />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-4 text-center" style={{ color: 'var(--stanford-cardinal)' }}>
            Visits by Application
          </h2>
          <div className="bg-white rounded-lg shadow-md p-4">
            <SimpleVisitsBarChart data={visitsSummary.map(app => ({ name: app.name, value: app.visits, uuid: app.uuid }))} />
          </div>
        </div>
      </section>

      {loading && (
        <div className="text-center text-lg" style={{ color: 'var(--stanford-cardinal)' }}>
          Loading...
        </div>
      )}
      {error && (
        <div className="text-center text-lg" style={{ color: 'var(--stanford-gold)' }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
