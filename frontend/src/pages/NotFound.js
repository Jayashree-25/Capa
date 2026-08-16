import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

const NotFound = () => (
  <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
    <h1 className="text-2xl font-semibold text-gray-800">Page not found</h1>
    <p className="mt-2 text-sm text-gray-500">The page you're looking for doesn't exist.</p>
    <Link to="/dashboard" className="inline-block mt-6">
      <Button>Back to Dashboard</Button>
    </Link>
  </div>
);

export default NotFound;