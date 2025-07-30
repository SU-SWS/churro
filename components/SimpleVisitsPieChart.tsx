'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface SimpleVisitsPieChartProps {
  data: { name: string; value: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const SimpleVisitsPieChart: React.FC<SimpleVisitsPieChartProps> = ({ data }) => {
  console.log('SimpleVisitsPieChart data:', data);
  
  return (
    <div className="w-full h-96 bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4 text-center">
        Simple Visits Pie Chart
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleVisitsPieChart;