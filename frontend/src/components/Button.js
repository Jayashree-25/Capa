import React from 'react';

export const Button = ({ onClick, children }) => {
  return (
    <button
      onClick={onClick}
      className="bg-blue-500 text-white p-2 rounded hover:bg-blue-700 transition duration-200"
    >
      {children}
    </button>
  );
};
