import React from 'react';

export const Button = ({ 
  onClick, 
  children, 
  type = 'button', 
  className = '', 
  form,
  disabled,
  ...props
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition ${className}`}
      form={form}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
