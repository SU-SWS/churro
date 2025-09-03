'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SummarizedData {
  name: string;
  value: number;
  uuid: string;
}

interface ViewsBarChartProps {
  data: SummarizedData[];
}

const COLORS = ['#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'];

const ViewsBarChart: React.FC<ViewsBarChartProps> = ({ data }) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !data) return;

    try {
      // Data is already summarized. We just filter and sort it.
      const filteredData = [...data]
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);

      setChartData(filteredData);

    } catch (error) {
      console.error('❌ Error preparing views bar chart data:', error);
      setChartData([]);
    }
  }, [data, isMounted]);

  if (!isMounted) {
    return <div className="w-full h-[400px] flex items-center justify-center"><div className="text-gray-500">Loading chart...</div></div>;
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center">
        <div className="text-center text-gray-500">No views data to display</div>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" width={140} interval={0} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Views']} cursor={{fill: 'rgba(206, 206, 206, 0.2)'}} />
          <Bar dataKey="value" name="Views">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ViewsBarChart;