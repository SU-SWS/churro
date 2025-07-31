'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

interface SimpleViewsBarChartProps {
  data: { name: string; value: number }[];
}

const SimpleViewsBarChart: React.FC<SimpleViewsBarChartProps> = ({ data }) => {
  console.log('SimpleViewsBarChart data:', data);
  
  // Convert to format needed for bar chart
  const chartData = data.map(item => ({
    name: item.name,
    views: item.value
  }));
  
  return (
    <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4 text-center">Simple Views Bar Chart</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
          <YAxis />
          <Bar dataKey="views" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleViewsBarChart;