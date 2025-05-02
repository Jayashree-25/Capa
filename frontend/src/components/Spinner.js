import React from 'react';

export const Spinner = ({ className = '' }) => (
  <div className={`inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent ${className}`} />
);
