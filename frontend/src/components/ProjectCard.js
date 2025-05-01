import React from 'react';
import { ProgressBar } from './ProgressBar';

export const ProjectCard = ({ project, onClick, onEdit }) => {
  const phases = project.phases ? Object.entries(project.phases) : [];

  // Calculate total progress
  const totalProgress = phases.length > 0
    ? phases.reduce((sum, [_, phase]) => sum + (phase.progress || 0), 0) / phases.length
    : 0;

  return (
    <div 
      className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 bg-white"
      onClick={onClick}
    >
      {/* Card Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold text-gray-800 line-clamp-1">
            {project.name}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
          >
            Edit
          </button>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-2">
          <ProgressBar value={totalProgress} />
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <StatBadge label="Phases" value={phases.length} />
          <StatBadge label="Members" value={project.totalTeamMembers || 0} />
          <StatBadge 
            label="Timeline" 
            value={`${formatDate(project.startDate)} - ${formatDate(project.endDate)}`} 
            fullWidth
          />
        </div>

        {/* Phase Breakdown */}
        {phases.length > 0 && (
          <div className="space-y-2">
            {phases.map(([phaseName, phase]) => (
              <PhaseItem 
                key={`${project.id}-${phaseName}`}
                phaseName={phaseName}
                phase={phase}
                className="bg-gray-50 rounded-md p-2"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Components
const StatBadge = ({ label, value, fullWidth = false }) => (
  <div className={`${fullWidth ? 'col-span-3' : ''}`}>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-medium text-gray-700 truncate">
      {value}
    </p>
  </div>
);

const PhaseItem = ({ phaseName, phase, className }) => (
  <div className={`flex justify-between items-center ${className}`}>
    <div>
      <span className="capitalize font-medium text-sm text-gray-700">
        {phaseName}
      </span>
      <p className="text-xs text-gray-500">
        {formatDate(phase.start)} - {formatDate(phase.end)}
      </p>
    </div>
    <div className="flex items-center space-x-2">
      <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
        {phase.teamMembers} members
      </span>
      <ProgressBar 
        value={phase.progress || 0} 
        size="sm" 
      />
    </div>
  </div>
);

// Reuse your existing date formatter
const formatDate = (mmYYYY) => {
  if (!mmYYYY) return 'N/A';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = parseInt(mmYYYY.substring(0, 2)) - 1;
  const year = mmYYYY.substring(2);
  return `${months[month]} '${year}`;
}; 