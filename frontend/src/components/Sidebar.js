import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', roles: ['boss', 'lead', 'engineer'] },
  { label: 'People', path: '/people', roles: ['boss', 'lead'] },
  { label: 'Users', path: '/users', roles: ['boss'] },
  { label: 'Tasks', path: '/tasks', roles: ['boss', 'lead'] },
  { label: 'Projects', path: '/projects', roles: ['boss', 'lead'] },
  { label: 'Organization', path: '/organization', roles: ['boss', 'lead'] }
];

const Sidebar = ({ user, onLogout, onNavigate }) => {
  const { pathname } = useLocation();
  const items = NAV_ITEMS.filter(item => item.roles.includes(user.role));

  return (
    <nav className="flex flex-col h-full p-3">
      <div className="flex flex-col gap-1">
        {items.map(item => {
          const isActive = pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              exact
              onClick={onNavigate}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className={`w-1 h-4 rounded-full ${isActive ? 'bg-blue-600' : 'bg-transparent'}`} />
              {item.label}
            </NavLink>
          );
        })}
      </div>
      <button
        onClick={onLogout}
        className="mt-auto flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
      >
        <span className="w-1 h-4 rounded-full bg-transparent" />
        Logout
      </button>
    </nav>
  );
};

export default Sidebar;