'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Sector, Legend, Tooltip } from 'recharts';

interface SummarizedData {
  name: string;
  value: number;
  uuid: string;
}

interface ViewsPieChartProps {
  data: SummarizedData[];
}

const COLORS = ['#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'];

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
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

const ViewsPieChart: React.FC<ViewsPieChartProps> = ({ data }) => {
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

    try {
      const chartDataArray = data.map((item, index) => ({
        ...item,
        fullName: item.name,
        name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
        color: COLORS[index % COLORS.length],
      }));

      const filteredData = chartDataArray.filter(item => item.value > 0).sort((a, b) => b.value - a.value);
      const total = filteredData.reduce((sum, item) => sum + item.value, 0);

      setChartData(filteredData);
      setTotalViews(total);
      setTotalApplications(filteredData.length);

    } catch (error) {
      console.error('❌ Error preparing views pie chart data:', error);
      setChartData([]);
      setTotalViews(0);
      setTotalApplications(0);
    }
  }, [data, isMounted]);

  // Safety check for SSR
  if (!isMounted) {
    return <div className="w-full h-[550px] bg-white p-4 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading chart...</div>
    </div>;
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full h-[550px] bg-white p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500">No views data to display</div>
          {data && data.length > 0 && <div className="text-sm text-gray-400 mt-2">{data.length} records received but no views found</div>}
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-[550px] bg-white p-4 rounded-lg border-1">
      <h3 className="text-lg font-semibold mb-2 text-center">
        Views by Application (Pie Chart)
      </h3>
      <div className="text-sm text-gray-600 text-center mb-4">
        {totalApplications} Applications • {totalViews.toLocaleString()} Total Views
      </div>

      {/* Pie chart container */}
      <div className="h-[450px] w-full relative mx-auto">
        <PieChart width={800} height={450} style={{ borderRadius: '8px'}}>
          <Pie
            activeIndex={activeIndex}
            activeShape={renderActiveShape}
            data={chartData}
            cx={400}
            cy={200}
            labelLine={true}
            label={({ name, percent }) => percent > 0.03 ? `${name} (${(percent * 100).toFixed(1)}%)` : ''}
            outerRadius={150}
            innerRadius={50}
            paddingAngle={1}
            fill="#8884d8"
            dataKey="value"
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
          >
            {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
          </Pie>
          <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Views']} />
          <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', paddingTop: '20px', width: '100%' }} />
        </PieChart>
      </div>
    </div>
  );
};

export default ViewsPieChart;