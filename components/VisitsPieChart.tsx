'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Sector, Legend, Tooltip } from 'recharts';

// Define the shape of the summarized data the chart now expects
interface SummarizedData {
  name: string;
  value: number;
  uuid: string;
}

interface VisitsPieChartProps {
  data: SummarizedData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'];

// Custom active shape for highlighting (no changes needed here)
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
        {`${(value || 0).toLocaleString()} Visits (${(percent * 100).toFixed(1)}%)`}
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

    // console.log('🎯 VisitsPieChart receiving pre-summarized data:', data.length, 'records');

    try {
      // Data is already summarized. We just add colors and sort.
      const chartDataArray = data.map((item, index) => ({
        ...item,
        fullName: item.name, // Keep full name for tooltips
        name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name, // Truncate for labels
        color: COLORS[index % COLORS.length],
      }));

      const filteredData = chartDataArray
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);

      const total = filteredData.reduce((sum, item) => sum + item.value, 0);

      // console.log(`🎯 Prepared pie chart data: ${filteredData.length} applications, ${total.toLocaleString()} total visits`);

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
    return <div className="w-full h-[550px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
      <div className="text-gray-500">Loading chart...</div>
    </div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[550px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
        <div className="text-gray-500">No visits data available</div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full h-[550px] bg-white p-4 rounded-lg shadow-md flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500">No visits data to display</div>
          {data && data.length > 0 && <div className="text-sm text-gray-400 mt-2">{data.length} records received but no visits found</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[550px] bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2 text-center">Visits by Application</h3>
      <div className="text-sm text-gray-600 text-center mb-4">{totalApplications} Applications • {totalVisits.toLocaleString()} Total Visits</div>
      <div className="h-[450px] w-full relative">
        <PieChart width={800} height={450} style={{margin: '0 auto'}}>
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
          <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Visits']} />
          <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', paddingTop: '20px', width: '100%' }} />
        </PieChart>
      </div>
    </div>
  );
};

export default VisitsPieChart;