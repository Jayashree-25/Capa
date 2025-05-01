import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Card } from './Card';
import { 
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { formatDate } from '../utils/dateUtils'; // Reuse your existing formatter

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export const CapacityBarChart = () => {
  const [capacityData, setCapacityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCapacityData = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/capacity');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch capacity data');
        setCapacityData(data.summary);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCapacityData();
  }, []);

  if (loading) return <div className="p-4 text-center">Loading capacity data...</div>;
  if (error) return <div className="p-4 text-center text-red-500">Error: {error}</div>;

  // Prepare chart data
  const chartData = {
    labels: capacityData.months.map(month => formatDate(month.month)),
    datasets: [
      {
        label: 'Allocated',
        data: capacityData.months.map(month => month.allocated),
        backgroundColor: '#4e79a7', // Blue
        borderColor: '#3a5f8a',
        borderWidth: 1,
      },
      {
        label: 'Unallocated',
        data: capacityData.months.map(month => month.unallocated),
        backgroundColor: '#f28e2b', // Orange
        borderColor: '#d97706',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      x: {
        stacked: true, // Stacked bars
      },
      y: {
        stacked: true,
        max: capacityData.totalTeamMembers, // Set max to total team members
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const dataset = context.dataset;
            const utilization = (dataset.data[context.dataIndex] / capacityData.totalTeamMembers * 100).toFixed(1);
            return `${dataset.label}: ${context.raw} (${utilization}%)`;
          },
        },
      },
    },
  };

  return (
    <Card className="p-6 mt-8">
      <h2 className="text-2xl font-semibold mb-4">Monthly Capacity Allocation</h2>
      <div className="h-80"> {/* Fixed height for consistency */}
        <Bar data={chartData} options={options} />
      </div>
    </Card>
  );
}; 