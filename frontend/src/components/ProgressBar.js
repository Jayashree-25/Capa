import React from 'react';

export const ProgressBar = ({ value = 0 }) => {
  return (
    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}; 