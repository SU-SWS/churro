'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts';
import { ViewsData } from '@/lib/acquia-api-fixed';

interface ViewsPieChartProps {
  data: ViewsData[];
  applicationMap?: Record<string, string>;
}

const COLORS = ['#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#0088FE'];

// Custom active shape for highlighting
const renderActiveShape = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-midAngle * Math.PI / 180);
  const cos = Math.cos(-midAngle * Math.PI / 180);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 5}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill}>
        {payload.name}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333">
        {`${value.toLocaleString()} Views (${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

const ViewsPieChart: React.FC<ViewsPieChartProps> = ({ data, applicationMap }) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [isMounted, setIsMounted] = useState(false);

  // Handle client-side only rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

  useEffect(() => {
    if (!isMounted || !data) return;
    
    console.log('🎯 ViewsPieChart processing data:', data.length, 'records');
    
    try {
      // Group data by application
      const applicationData: Record<string, any> = {};
      
      data.forEach(item => {
        const appKey = item.applicationUuid;
        const appName = applicationMap?.[appKey] || item.applicationName || `App ${appKey.substring(0, 8)}`;
        
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
      const chartDataArray = Object.values(applicationData).map((app: any, index) => ({
        name: app.applicationName.length > 15 ? app.applicationName.substring(0, 15) + '...' : app.applicationName,
        fullName: app.applicationName,
        shortUuid: app.shortUuid,
        value: app.totalViews,
        environments: app.environments.size,
        datapoints: app.datapoints,
        applicationUuid: app.applicationUuid,
        color: COLORS[index % COLORS.length],
      }));
      
      // Filter out zero values and sort
      const filteredData = chartDataArray
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
      
      const total = filteredData.reduce((sum, item) => sum + item.value, 0);
      
      console.log(`🎯 Prepared pie chart data: ${filteredData.length} applications, ${total} total views`);
      
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
    return <div className="w-full h-[500px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
      <p className="text-gray-500">Loading chart...</p>
    </div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[500px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
        <p className="text-gray-500">No views data available</p>
      </div>
    );
  }

  if (chartData.length === 0 || totalViews === 0) {
    return (
      <div className="w-full h-[500px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
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
    <div className="w-full h-[500px] bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2 text-center">
        Views by Application (Pie Chart)
      </h3>
      <p className="text-sm text-gray-600 text-center mb-4">
        {totalApplications} Applications • {totalViews.toLocaleString()} Total Views
      </p>
      
      {/* Pie chart container */}
      <div className="h-[400px] w-full relative">
        <PieChart width={800} height={400} style={{margin: '0 auto'}}>
          <Pie
            activeIndex={activeIndex}
            activeShape={renderActiveShape}
            data={chartData}
            cx={400}
            cy={180}
            labelLine={true}
            label={({ name, shortUuid, percent }) => 
              percent > 0.03 ? `${shortUuid} (${(percent * 100).toFixed(1)}%)` : ''
            }
            outerRadius={130}
            innerRadius={40}
            paddingAngle={1}
            fill="#8884d8"
            dataKey="value"
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
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
          <Legend 
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{
              fontSize: '10px',
              paddingLeft: '10px',
              width: '150px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}
            formatter={(value, entry: any) => (
              <span style={{
                color: entry.color,
                fontSize: '9px',
                display: 'inline-block',
                width: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {entry.payload.name}
              </span>
            )}
          />
        </PieChart>
      </div>
    </div>
  );
};

export default ViewsPieChart;