import React from 'react';

export const Card = ({ children }) => {
  return (
    <div className="border border-gray-200 rounded-xl shadow-sm bg-white p-5">
      {children}
    </div>
  );
};