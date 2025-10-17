'use client';

import { BarChart } from '@mui/x-charts/BarChart';
import { Box } from '@mui/material';

interface SimpleVisitsBarChartProps {
  data: { name: string; value: number }[];
}

const SimpleVisitsBarChart: React.FC<SimpleVisitsBarChartProps> = ({ data }) => {
  // Data is already sorted from the parent component
  const chartData = data.map(item => ({
    name: item.name,
    visits: item.value
  }));
  
  return (
    <Box 
      sx={{ 
        width: '100%', 
        height: 384, // h-96 = 384px
        bgcolor: 'white', 
        p: 2, 
        borderRadius: 2 
      }}
    >
      <BarChart
        dataset={chartData}
        yAxis={[{ 
          scaleType: 'band', 
          dataKey: 'name',
          categoryGapRatio: 0.3,
          barGapRatio: 0.1,
        }]}
        xAxis={[{ 
          label: 'Visits',
        }]}
        series={[
          { 
            dataKey: 'visits', 
            label: 'Visits',
            color: '#8C1515', // Cardinal red
            valueFormatter: (value) => value?.toLocaleString() ?? '0',
          }
        ]}
        layout="horizontal"
        grid={{ vertical: true, horizontal: true }}
        margin={{ top: 10, right: 30, left: 150, bottom: 40 }}
         slotProps={{
          legend: { sx: { display: 'none' } },
        }}
        sx={{
          '& .MuiChartsAxis-tickLabel': {
            fontSize: '13px',
          },
          '& .MuiChartsAxis-label': {
            fontSize: '16px',
          },
        }}
      />
    </Box>
  );
};

export default SimpleVisitsBarChart;