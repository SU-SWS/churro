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

  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/acquia/applications');
      if (!response.ok) {
        console.error('Failed to fetch applications');
        return;
      }

      const apps = await response.json();
      // console.log('📱 Fetched applications:', apps.length);

      setApplications(apps);

      // Create a mapping of UUID to name
      const appMap: Record<string, string> = {};
      apps.forEach((app: Application) => {
        appMap[app.uuid] = app.name;
      });

      setApplicationMap(appMap);
      // console.log('📱 Created application map with', Object.keys(appMap).length, 'entries');

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

      // console.log('🔄 Fetching data with params:', { subscriptionUuid, dateFrom, dateTo });

      // Fetch visits data
      setLoadingStep('Fetching visits data from Acquia API...');
      const visitsResponse = await fetch(`/api/acquia/visits?${params}`);

      if (!visitsResponse.ok) {
        const visitsError = await visitsResponse.text();
        console.error('Visits API Error:', visitsError);
        throw new Error('Failed to fetch visits data from API');
      }

      const visitsResult = await visitsResponse.json();
      // console.log('📊 Received visits result with length:', Array.isArray(visitsResult) ? visitsResult.length : 'not an array');
      // Fetch views data
      setLoadingStep('Fetching views data from Acquia API...');
      const viewsResponse = await fetch(`/api/acquia/views?${params}`);

      if (!viewsResponse.ok) {
        const viewsError = await viewsResponse.text();
        console.error('Views API Error:', viewsError);
        throw new Error('Failed to fetch views data from API');
      }

      const viewsResult = await viewsResponse.json();
      // console.log('📈 Received views result with length:', Array.isArray(viewsResult) ? viewsResult.length : 'not an array');
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
      className="min-h-screen p-8">
      <header className="mb-8 text-center">
        <div className="mt-2 text-black text-lg">
          This dashboard shows your monthly usage for Acquia Cloud hosting.<br />
          <span className="text-cardinal-red font-semibold">
            Monthly limits: {monthlyVisitsEntitlement.toLocaleString()} visits and {monthlyViewsEntitlement.toLocaleString()} views.
          </span>
        </div>
      </header>

      <section className="mb-8 max-w-xl mx-auto bg-black-10 rounded-lg p-15 border-2 border-black-10 mb-25">
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
          </div>

          <p className="p-8 text-base text-black-60 font-semibold">
            (Note that it can take several minutes to fetch data from the Acquia API.)
          </p>

        </form>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 justify-center border-b border-gray-300">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 text-lg py-2 rounded-t font-semibold border-b-2 transition-colors duration-150 ${
              activeTab === tab.key
                ? 'border-cardinal-red text-white bg-cardinal-red'
                : 'border-transparent text-black bg-gray-100 hocus:bg-white border border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg p-4 border border-t-0 mb-50">
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
    </div>

  );
};

export default Dashboard;
