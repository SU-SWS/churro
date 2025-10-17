'use client';

import { useState, useEffect } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { Box, Typography } from '@mui/material';

interface SummarizedData {
  name: string;
  value: number;
  uuid: string;
}

interface ViewsPieChartProps {
  data: SummarizedData[];
}

const COLORS = ['#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'];

const ViewsPieChart: React.FC<ViewsPieChartProps> = ({ data }) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  // Handle client-side only rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !data) return;
    
    try {
      const chartDataArray = data.map((item, index) => ({
        id: item.uuid,
        value: item.value,
        label: item.name,
        color: COLORS[index % COLORS.length],
      }));
      
      const filteredData = chartDataArray
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
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
    return (
      <Box 
        sx={{ 
          width: '100%', 
          height: 550, 
          bgcolor: 'white', 
          p: 2, 
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Typography color="text.secondary">Loading chart...</Typography>
      </Box>
    );
  }

  if (chartData.length === 0) {
    return (
      <Box 
        sx={{ 
          width: '100%', 
          height: 550, 
          bgcolor: 'white', 
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box textAlign="center">
          <Typography color="text.secondary">No views data to display</Typography>
          {data && data.length > 0 && (
            <Typography variant="body2" color="text.disabled" mt={1}>
              {data.length} records received but no views found
            </Typography>
          )}
        </Box>
      </Box>
    );
  }
  
  return (
    <Box 
      sx={{ 
        width: '100%', 
        height: 550, 
        bgcolor: 'white', 
        p: 2, 
        borderRadius: 2,
        border: '1px solid #e0e0e0'
      }}
    >
      <Typography variant="h6" fontWeight="600" textAlign="center" mb={1}>
        Views by Application (Pie Chart)
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" mb={2}>
        {totalApplications} Applications • {totalViews.toLocaleString()} Total Views
      </Typography>
      
      {/* Pie chart container */}
      <Box sx={{ height: 450, width: '100%', position: 'relative', mx: 'auto' }}>
          <PieChart
          series={[
            {
              data: chartData,
              highlightScope: { fade: 'global', highlight: 'item' },
              faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
              innerRadius: 50,
              outerRadius: 150,
              paddingAngle: 1,
              cornerRadius: 0,
              cx: 400,
              cy: 200,
              valueFormatter: (value) => `${value.value.toLocaleString()} views`,
            },
          ]}
          colors={chartData.map(item => item.color)}
          width={800}
          height={450}
          slotProps={{
            legend: {
              direction: 'horizontal',
              position: { vertical: 'bottom', horizontal: 'center' },
            },
            tooltip: { trigger: 'item' },
          }}
        />
      </Box>
    </Box>
  );
};

export default ViewsPieChart;