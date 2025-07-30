'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts';
import { VisitsData } from '@/lib/acquia-api-fixed';

interface VisitsPieChartProps {
  data: VisitsData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'];

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
        {`${value.toLocaleString()} Visits (${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

const VisitsPieChart: React.FC<VisitsPieChartProps> = ({ data }) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalVisits, setTotalVisits] = useState(0);
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
    
    console.log('🎯 VisitsPieChart processing data:', data.length, 'records');
    
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
            shortUuid: item.applicationUuid.substring(0, 8),
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
      const chartDataArray = Object.values(applicationData).map((app: any, index) => ({
        name: app.applicationName.length > 15 ? app.applicationName.substring(0, 15) + '...' : app.applicationName,
        fullName: app.applicationName,
        shortUuid: app.shortUuid,
        value: app.totalVisits,
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
      
      console.log(`🎯 Prepared pie chart data: ${filteredData.length} applications, ${total} total visits`);
      
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
    return <div className="w-full h-[500px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
      <p className="text-gray-500">Loading chart...</p>
    </div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[500px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
        <p className="text-gray-500">No visits data available</p>
      </div>
    );
  }

  if (chartData.length === 0 || totalVisits === 0) {
    return (
      <div className="w-full h-[500px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
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
    <div className="w-full h-[500px] bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2 text-center">
        Visits by Application (Pie Chart)
      </h3>
      <p className="text-sm text-gray-600 text-center mb-4">
        {totalApplications} Applications • {totalVisits.toLocaleString()} Total Visits
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
            formatter={(value: number) => [value.toLocaleString(), 'Visits']}
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
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
            formatter={(value, entry: any) => (
              <span style={{ color: entry.color, fontSize: '10px' }}>
                {entry.payload.shortUuid}: {entry.payload.value.toLocaleString()}
              </span>
            )}
          />
        </PieChart>
      </div>
    </div>
  );
};

export default VisitsPieChart;