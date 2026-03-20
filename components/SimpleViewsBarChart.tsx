'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

const compactNumberFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const AXIS_TICK_FONT_SIZE = 15;

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
    <div className="w-full h-96 bg-white p-4 rounded-lg">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
          barGap={8}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={{ fontSize: AXIS_TICK_FONT_SIZE }}
            tickFormatter={(value: number) =>
              compactNumberFormat.format(value)
            }
          />
          <YAxis dataKey="name" type="category" width={300} interval={0} tick={{ fontSize: AXIS_TICK_FONT_SIZE }} />
          <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Views']} cursor={{fill: 'rgba(206, 206, 206, 0.2)'}} />
          <Bar dataKey="views"  className='fill-cardinal-red' />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleViewsBarChart;