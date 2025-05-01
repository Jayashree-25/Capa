import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import { formatDate } from '../utils/dateUtils';
import './CapacityVisualization.css';

export const CapacityVisualization = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/capacity')
      .then(res => res.json())
      .then(setData);
  }, []);

  if (!data) return <div className="p-4">Loading...</div>;

  // Get unique projects
  const projects = {};
  Object.values(data.details).forEach(monthPhases => {
    monthPhases.forEach(({ project }) => {
      projects[project] = true;
    });
  });
  const projectNames = Object.keys(projects);

  return (
    <Card className="p-4 w-full overflow-x-auto bg-white">
      {/* Header Row */}
      <div className="flex min-w-max bg-gray-50 sticky top-0 z-20">
        <div className="w-48 font-medium p-2 border-b-2 border-gray-200">Projects</div>
        {data.summary.months.map(month => (
          <div
            key={month.month}
            className="flex-1 min-w-[120px] text-center border-b-2 border-gray-200 p-2 font-medium"
          >
            {formatDate(month.month)}
            <div className="text-xs text-gray-500">
              {month.utilization * 100}% utilized
            </div>
          </div>
        ))}
      </div>

      {/* Swimlane Rows */}
      <div className="flex flex-col min-w-max">
        {projectNames.map(project => (
          <div key={project} className="flex border-b border-gray-100 hover:bg-gray-50">
            {/* Project Name Column */}
            <div className="w-48 p-2 font-medium sticky left-0 bg-white z-10">
              {project}
            </div>

            {/* Phase Boxes */}
            {data.summary.months.map(month => {
              const monthPhases = data.details[month.month] || [];
              const projectPhases = monthPhases.filter(p => p.project === project);
              const remainingPercentage = 100 - (month.utilization * 100);

              return (
                <div
                  key={month.month}
                  className="flex-1 min-w-[120px] border-r border-gray-100 p-1"
                >
                  {projectPhases.map(phase => (
                    <div
                      key={`${phase.phase}-${month.month}`}
                      className="mb-1 p-1 rounded text-xs relative"
                      style={{ 
                        backgroundColor: getPhaseColor(phase.phase),
                      }}
                    >
                      <div className="capitalize font-medium">{phase.phase}</div>
                      <div>{phase.teamMembers} members</div>
                      <div className="text-[10px] mt-1 text-gray-600">
                        {remainingPercentage.toFixed(1)}% remaining
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Totals Row */}
      <div className="flex min-w-max bg-gray-50 font-medium border-t-2">
        <div className="w-48 p-2">Total Allocation</div>
        {data.summary.months.map(month => (
          <div key={month.month} className="flex-1 min-w-[120px] text-center p-2">
            {month.allocated}/{month.allocated + month.unallocated}
          </div>
        ))}
      </div>
    </Card>
  );
};

// Phase colors
const getPhaseColor = (phase) => {
  const colors = {
    discovery: '#BFDBFE', // blue-200
    build: '#FDE68A',    // amber-200
    testing: '#A7F3D0',  // emerald-200
  };
  return colors[phase] || '#E5E7EB'; // gray-200
};
