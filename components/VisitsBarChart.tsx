'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { VisitsData } from '@/lib/acquia-api-fixed';

interface VisitsBarChartProps {
  data: VisitsData[];
}

const VisitsBarChart: React.FC<VisitsBarChartProps> = ({ data }) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalVisits, setTotalVisits] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  // Handle client-side only rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !data) return;
    
    console.log('📊 VisitsBarChart processing data:', data.length, 'records');
    
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
            totalVisits: 0,
            environments: new Set<string>(),
            datapoints: 0
          };
        }
        
        applicationData[appKey].totalVisits += item.visits || 0;
        applicationData[appKey].datapoints += 1;
        if (item.environmentName) {
          applicationData[appKey].environments.add(item.environmentName);
        }
      });
      
      // Convert to array for chart
      const chartDataArray = Object.values(applicationData).map((app: any) => ({
        application: app.applicationName.length > 15 ? app.applicationName.substring(0, 15) + '...' : app.applicationName,
        fullName: app.applicationName,
        visits: app.totalVisits,
        environments: app.environments.size,
        datapoints: app.datapoints,
        applicationUuid: app.applicationUuid,
      }));
      
      // Filter out zero values and sort
      const filteredData = chartDataArray
        .filter(item => item.visits > 0)
        .sort((a, b) => b.visits - a.visits);
      
      const total = filteredData.reduce((sum, item) => sum + item.visits, 0);
      
      console.log(`📊 Prepared bar chart data: ${filteredData.length} applications, ${total} total visits`);
      
      setChartData(filteredData);
      setTotalVisits(total);
      setTotalApplications(filteredData.length);
      
    } catch (error) {
      console.error('❌ Error preparing chart data:', error);
      setChartData([]);
      setTotalVisits(0);
      setTotalApplications(0);
    }
  }, [data, isMounted]);

  // Safety check for SSR
  if (!isMounted) {
    return <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
      <p className="text-gray-500">Loading chart...</p>
    </div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
        <p className="text-gray-500">No visits data available</p>
      </div>
    );
  }

  if (chartData.length === 0 || totalVisits === 0) {
    return (
      <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">No visits data to display</p>
          <p className="text-sm text-gray-400 mt-2">
            {data.length} records received but no visits found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2 text-center">Visits by Application (Bar Chart)</h3>
      <p className="text-sm text-gray-600 text-center mb-4">
        {totalApplications} Applications • {totalVisits.toLocaleString()} Total Visits
      </p>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="application" 
            angle={-45}
            textAnchor="end"
            height={100}
            interval={0}
            fontSize={10}
          />
          <YAxis />
          <Tooltip 
            formatter={(value: number) => [value.toLocaleString(), 'Visits']}
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
                </div>
              ) : label;
            }}
          />
          <Legend />
          <Bar dataKey="visits" fill="#0088FE" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VisitsBarChart;