'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ViewsData } from '@/lib/acquia-api-fixed';

interface ViewsBarChartProps {
  data: ViewsData[];
  applicationMap?: Record<string, string>;
}

const ViewsBarChart: React.FC<ViewsBarChartProps> = ({ data, applicationMap = {} }) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  // Handle client-side only rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !data) return;
    
    console.log('📊 ViewsBarChart processing data:', data.length, 'records');
    
    try {
      // Group data by application
      const applicationData: Record<string, any> = {};
      
      data.forEach(item => {
        const appKey = item.applicationUuid;
        const appName = applicationMap[appKey] || item.applicationName || `App ${appKey.substring(0, 8)}`;
        
        if (!applicationData[appKey]) {
          applicationData[appKey] = {
            applicationUuid: item.applicationUuid,
            applicationName: appName,
            shortUuid: item.applicationUuid.substring(0, 8),
            totalViews: 0,
            environments: new Set<string>(),
            datapoints: 0
          };
        }
        
        applicationData[appKey].totalViews += item.views || 0;
        applicationData[appKey].datapoints += 1;
        if (item.environmentName) {
          applicationData[appKey].environments.add(item.environmentName);
        }
      });
      
      // Convert to array for chart
      const chartDataArray = Object.values(applicationData).map((app: any) => ({
        application: app.applicationName.length > 20 ? app.applicationName.substring(0, 20) + '...' : app.applicationName,
        fullName: app.applicationName,
        shortUuid: app.shortUuid,
        views: app.totalViews,
        environments: app.environments.size,
        datapoints: app.datapoints,
        applicationUuid: app.applicationUuid,
      }));
      
      // Filter out zero values and sort
      const filteredData = chartDataArray
        .filter(item => item.views > 0)
        .sort((a, b) => b.views - a.views);
      
      const total = filteredData.reduce((sum, item) => sum + item.views, 0);
      
      console.log(`📊 Prepared bar chart data: ${filteredData.length} applications, ${total.toLocaleString()} total views`);
      
      setChartData(filteredData);
      setTotalViews(total);
      setTotalApplications(filteredData.length);
      
    } catch (error) {
      console.error('❌ Error preparing chart data:', error);
      setChartData([]);
      setTotalViews(0);
      setTotalApplications(0);
    }
  }, [data, isMounted, applicationMap]);

  // Safety check for SSR
  if (!isMounted) {
    return <div className="w-full h-[650px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
      <div className="text-gray-500">Loading chart...</div>
    </div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[650px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
        <div className="text-gray-500">No views data available</div>
      </div>
    );
  }

  if (chartData.length === 0 || totalViews === 0) {
    return (
      <div className="w-full h-[650px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500">No views data to display</div>
          <div className="text-sm text-gray-400 mt-2">
            {data.length} records received but no views found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[650px] bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2 text-center">Views by Application (Bar Chart)</h3>
      <div className="text-sm text-gray-600 text-center mb-4">
        {totalApplications} Applications • {totalViews.toLocaleString()} Total Views
      </div>
      
      <div className="h-[550px] w-full">
        <BarChart 
          layout="vertical"
          width={1000} 
          height={550}
          data={chartData}
          margin={{ top: 20, right: 50, left: 120, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            domain={[0, 'dataMax']}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <YAxis 
            type="category"
            dataKey="application" 
            width={120}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString(), 'Views']}
            labelFormatter={(label: string, payload: any) => {
              const data = payload?.[0]?.payload;
              return data ? (
                <div>
                  <div><strong>{data.fullName}</strong></div>
                  <div className="text-sm text-gray-600">
                    UUID: {data.applicationUuid}
                  </div>
                  <div className="text-sm text-gray-600">
                    Environments: {data.environments}
                  </div>
                </div>
              ) : label;
            }}
          />
          <Legend />
          <Bar dataKey="views" fill="#00C49F" />
        </BarChart>
      </div>
    </div>
  );
};

export default ViewsBarChart;