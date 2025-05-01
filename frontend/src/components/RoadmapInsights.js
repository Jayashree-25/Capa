import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Line } from 'recharts';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';

// Team color mapping
const getTeamColor = (team) => ({
  'Backend': '#6366F1',
  'Frontend': '#EC4899',
  'Design': '#F59E0B',
  'Unassigned': '#3B82F6'
}[team || 'Unassigned']);

// Improved date validation
const parseSafeDate = (date, fallback) => {
  const jsDate = date && dayjs(date).isValid() ? new Date(date) : new Date(fallback);
  return dayjs(jsDate); // Always return dayjs object
};

export const RoadmapInsights = ({ projects, capacity }) => {
  // State for timeframe selection
  const [selectedMonth, setSelectedMonth] = React.useState(
    dayjs().format('YYYY-MM')
  );

  // Transform capacity data
  const capacityData = React.useMemo(() => {
    if (!capacity) return [];
    
    return Object.entries(capacity).map(([team, months]) => {
      const monthData = months[selectedMonth] || Object.values(months)[0];
      return {
        team: team || 'Unassigned',
        available: Number(monthData?.available) || 0,
        allocated: Number(monthData?.allocated) || 0,
        utilization: parseFloat(monthData?.utilization) || 0
      };
    });
  }, [capacity, selectedMonth]);

  // Filter projects for selected month (simplified, no Gantt logic)
  const filteredItems = React.useMemo(() => {
    if (!projects) return [];
    
    const monthStart = dayjs(selectedMonth).startOf('month');
    const monthEnd = dayjs(selectedMonth).endOf('month');
    
    return projects.filter(project => {
      try {
        const projectStart = parseSafeDate(project.startDate, dayjs());
        const projectEnd = parseSafeDate(project.end, projectStart.add(1, 'month'));
        
        // Check if project overlaps with selected month
        return (
          (projectStart.isAfter(monthStart) && projectStart.isBefore(monthEnd)) ||
          (projectEnd.isAfter(monthStart) && projectEnd.isBefore(monthEnd)) ||
          (projectStart.isBefore(monthStart) && projectEnd.isAfter(monthEnd))
        );
      } catch (e) {
        console.error('Date filtering error:', e);
        return false;
      }
    });
  }, [projects, selectedMonth]);

  const monthRange = React.useMemo(() => ({
    start: dayjs(selectedMonth).startOf('month'),
    end: dayjs(selectedMonth).endOf('month')
  }), [selectedMonth]);

  return (
    <div className="space-y-6 p-4">
      {/* Month Selector */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-2">Timeframe</h3>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* Capacity Overview */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">
          Team Capacity - {dayjs(selectedMonth).format('MMMM YYYY')}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={capacityData}>
            <XAxis dataKey="team" />
            <YAxis yAxisId="hours" />
            <YAxis yAxisId="utilization" orientation="right" domain={[0, 1]} />
            <Tooltip 
              formatter={(value, name) => 
                name === 'Utilization' 
                  ? [`${(value * 100).toFixed(0)}%`] 
                  : [`${value} hours`]
              }
              labelFormatter={(team) => `${team} Team`}
            />
            <Legend />
            <Bar yAxisId="hours" dataKey="available" fill="#4CAF50" name="Available" />
            <Bar yAxisId="hours" dataKey="allocated" fill="#F44336" name="Allocated" />
            <Line 
              yAxisId="utilization" 
              dataKey="utilization" 
              stroke="#6366F1" 
              name="Utilization"
              strokeWidth={2}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Project Timeline (Placeholder) */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">
          Active Projects ({filteredItems.length})
        </h3>
        <p className="text-gray-500">Project timeline visualization is currently disabled.</p>
      </div>
    </div>
  );
};

RoadmapInsights.propTypes = {
  projects: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      startDate: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      end: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      team: PropTypes.string,
      phases: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          start: PropTypes.string,
          end: PropTypes.string
        })
      )
    })
  ),
  capacity: PropTypes.object
};
