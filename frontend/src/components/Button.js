import React from 'react';

const VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700'
};

export const Button = ({
  onClick,
  children,
  type = 'button',
  className = '',
  variant = 'primary',
  form,
  disabled,
  ...props
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`px-4 py-2 rounded transition ${VARIANTS[variant]} ${className}`}
      form={form}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};