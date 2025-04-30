import React from 'react';

export const Card = ({ children }) => {
  return (
    <div className="border rounded-lg shadow-md bg-white p-4">
      {children}
    </div>
  );
};
