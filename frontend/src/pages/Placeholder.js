import React from 'react';

const Placeholder = ({ title }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-8">
    <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
    <p className="mt-2 text-sm text-gray-500">
      This section will be available here in a future update.
    </p>
  </div>
);

export default Placeholder;