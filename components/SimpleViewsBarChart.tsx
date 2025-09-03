'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

interface SimpleViewsBarChartProps {
  data: { name: string; value: number }[];
}

const SimpleViewsBarChart: React.FC<SimpleViewsBarChartProps> = ({ data }) => {
  // Data is already sorted from the parent component
  const chartData = data.map(item => ({
    name: item.name,
    views: item.value
  }));
  
  return (
    <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" width={140} interval={0} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Views']} cursor={{fill: 'rgba(206, 206, 206, 0.2)'}} />
          <Bar dataKey="views" fill="var(--stanford-cardinal)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleViewsBarChart;