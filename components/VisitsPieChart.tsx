'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { VisitsData } from '@/lib/acquia-api-fixed';

interface VisitsPieChartProps {
  data: VisitsData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'];

const VisitsPieChart: React.FC<VisitsPieChartProps> = ({ data }) => {
  console.log('🎯 VisitsPieChart processing data:', data.length, 'records');

  // Aggregate visits by application (sum all datapoints across all environments and dates)
  const applicationData = data.reduce((acc, item) => {
    const appKey = item.applicationUuid;
    const appName = item.applicationName || `App ${item.applicationUuid.substring(0, 8)}`;
    
    if (!acc[appKey]) {
      acc[appKey] = {
        applicationUuid: item.applicationUuid,
        applicationName: appName,
        totalVisits: 0,
        environments: new Set<string>(),
        datapoints: 0
      };
    }
    acc[appKey].totalVisits += item.visits || 0;
    acc[appKey].datapoints += 1;
    if (item.environmentName) {
      acc[appKey].environments.add(item.environmentName);
    }
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(applicationData).map((app: any, index) => ({
    name: app.applicationName.length > 25 ? app.applicationName.substring(0, 25) + '...' : app.applicationName,
    fullName: app.applicationName,
    value: app.totalVisits,
    environments: app.environments.size,
    datapoints: app.datapoints,
    applicationUuid: app.applicationUuid,
    color: COLORS[index % COLORS.length],
  }));

  // Sort by visits (descending) and filter out zero values
  const filteredData = chartData.filter(item => item.value > 0);
  filteredData.sort((a, b) => b.value - a.value);

  const totalVisits = filteredData.reduce((sum, item) => sum + item.value, 0);
  const totalApplications = filteredData.length;
  const totalDatapoints = data.length;

  console.log('🎯 Chart summary:', { 
    totalVisits, 
    totalApplications, 
    totalDatapoints,
    apps: filteredData.map(app => `${app.fullName}: ${app.value} visits`)
  });

  if (filteredData.length === 0 || totalVisits === 0) {
    return (
      <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">No visits data available</p>
          <p className="text-sm text-gray-400 mt-2">
            {data.length} datapoints received but no visits found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2 text-center">
        Visits by Application
      </h3>
      <p className="text-sm text-gray-600 text-center mb-4">
        {totalApplications} Applications • {totalVisits.toLocaleString()} Total Visits • {totalDatapoints} Datapoints
      </p>
      <ResponsiveContainer width="100%" height="85%">
        <PieChart>
          <Pie
            data={filteredData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent, value }) => 
              percent > 0.05 ? `${name}: ${(percent * 100).toFixed(1)}%` : ''
            }
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {filteredData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
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
                  <div className="text-sm text-gray-600">
                    Datapoints: {data.datapoints}
                  </div>
                </div>
              ) : label;
            }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            formatter={(value, entry: any) => (
              <span style={{ color: entry.color }}>
                {entry.payload.name} ({entry.payload.value.toLocaleString()})
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VisitsPieChart;