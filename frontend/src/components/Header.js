import React from 'react';
import { Link } from 'react-router-dom';

const ROLE_BADGE = {
  boss: 'bg-gray-900 text-white',
  lead: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  engineer: 'bg-green-100 text-green-800'
};

const Header = ({ user, onMenuClick }) => {
  const displayRole = user.personRole || user.role;
  return (
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
          <Link
            to="/profile"
            className="text-right leading-tight rounded-md px-2 py-1 -mr-2 hover:bg-gray-50"
            title="View profile"
          >
            <div className="text-sm font-medium text-gray-800">{user.personName || user.email}</div>
            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${ROLE_BADGE[displayRole] || 'bg-gray-100 text-gray-600'}`}>
              {displayRole}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;