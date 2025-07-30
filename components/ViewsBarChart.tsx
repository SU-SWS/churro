'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ViewsData } from '@/lib/acquia-api-fixed';

interface ViewsBarChartProps {
  data: ViewsData[];
}

const ViewsBarChart: React.FC<ViewsBarChartProps> = ({ data }) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);

  useEffect(() => {
    console.log('📊 ViewsBarChart received data:', data.length, 'records');
    if (!data || data.length === 0) {
      console.log('⚠️ No views data provided');
      setChartData([]);
      setTotalViews(0);
      setTotalApplications(0);
      return;
    }

    try {
      // Group data by application
      const applicationData: Record<string, any> = {};
      
      data.forEach(item => {
        const appKey = item.applicationUuid;
        const appName = item.applicationName || `App ${item.applicationUuid.substring(0, 8)}`;
        
        if (!applicationData[appKey]) {
          applicationData[appKey] = {
            applicationUuid: item.applicationUuid,
            applicationName: appName,
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
      
      console.log(`📊 Prepared chart data: ${filteredData.length} applications, ${total} total views`);
      
      setChartData(filteredData);
      setTotalViews(total);
      setTotalApplications(filteredData.length);
      
    } catch (error) {
      console.error('❌ Error preparing chart data:', error);
      setChartData([]);
      setTotalViews(0);
      setTotalApplications(0);
    }
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
        <p className="text-gray-500">No views data available</p>
      </div>
    );
  }

  if (chartData.length === 0 || totalViews === 0) {
    return (
      <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">No views data to display</p>
          <p className="text-sm text-gray-400 mt-2">
            {data.length} records received but no views found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2 text-center">Views by Application</h3>
      <p className="text-sm text-gray-600 text-center mb-4">
        {totalApplications} Applications • {totalViews.toLocaleString()} Total Views
      </p>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="application" 
            angle={-45}
            textAnchor="end"
            height={120}
            interval={0}
            fontSize={10}
          />
          <YAxis />
          <Tooltip 
            formatter={(value: number) => [value.toLocaleString(), 'Views']}
            labelFormatter={(label: string, payload: any) => {
              const data = payload?.[0]?.payload;
              return data ? (
                <div>
                  <div><strong>{data.fullName}</strong></div>
                  <div className="text-sm text-gray-600">
                    UUID: {data.applicationUuid.substring(0, 8)}...
                  </div>
                  <div className="text-sm text-gray-600">
                    Environments: {data.environments}
                  </div>
                  <div className="text-sm text-gray-600">
                    Datapoints: {data.datapoints}
                  </div>
                </div>
              ) : label;
            }}
          />
          <Legend />
          <Bar dataKey="views" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ViewsBarChart;