import React from 'react';
import { Button } from './Button';

const Header = ({ user, onLogout, onMenuClick }) => (
  <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
    <div className="flex items-center justify-between h-14 px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-label="Open navigation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-lg font-bold tracking-wide text-gray-900">CAPA</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium text-gray-800">{user.personName || user.email}</div>
          <div className="text-xs text-gray-500 capitalize">{user.role}</div>
        </div>
        <Button onClick={onLogout} className="bg-gray-600 hover:bg-gray-700">
          Logout
        </Button>
      </div>
    </div>
  </header>
);

export default Header;