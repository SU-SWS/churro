'use client';

import { useState, useEffect } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { Box, Typography } from '@mui/material';

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

const VisitsPieChart: React.FC<VisitsPieChartProps> = ({ data }) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalVisits, setTotalVisits] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !data) return;
    
    try {
      // Data is already summarized. We just add colors and sort.
      const chartDataArray = data.map((item, index) => ({
        id: item.uuid,
        value: item.value,
        label: item.name,
        fullName: item.name, // Keep full name for tooltips
        color: COLORS[index % COLORS.length],
      }));
      
      const filteredData = chartDataArray
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
      
      const total = filteredData.reduce((sum, item) => sum + item.value, 0);
      
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
    return (
      <Box 
        sx={{ 
          width: '100%', 
          height: 300, 
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

  if (!data || data.length === 0) {
    return (
      <Box 
        sx={{ 
          width: '100%', 
          height: 'auto', 
          bgcolor: 'white', 
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Typography color="text.secondary">No visits data available</Typography>
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
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box textAlign="center">
          <Typography color="text.secondary">No visits data to display</Typography>
          {data && data.length > 0 && (
            <Typography variant="body2" color="text.disabled" mt={1}>
              {data.length} records received but no visits found
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
        p: 2
      }}
    >
      <Typography variant="h6" fontWeight="600" textAlign="center" mb={1}>
        Visits by Application
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" mb={2}>
        {totalApplications} Applications • {totalVisits.toLocaleString()} Total Visits
      </Typography>
      
      <Box sx={{ height: 375, width: '100%', position: 'relative' }}>
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
              valueFormatter: (value) => `${value.value.toLocaleString()} visits`,
            },
          ]}
          colors={chartData.map(item => item.color)}
          width={800}
          height={375}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          slotProps={{
            legend: {
              direction: 'horizontal',
              position: { vertical: 'bottom', horizontal: 'center' },
              sx: {
                fontSize: 10,
              },
            },
          }}
          sx={{ margin: '0 auto' }}
        />
      </Box>
    </Box>
  );
};

export default VisitsPieChart;