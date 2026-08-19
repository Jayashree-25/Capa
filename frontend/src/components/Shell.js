import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

const Shell = ({ user, onLogout, children }) => {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} onLogout={onLogout} onMenuClick={() => setNavOpen(true)} />
      <div className="flex">
        <aside className="hidden md:block w-56 shrink-0 bg-white border-r border-gray-200 sticky top-14 self-start h-[calc(100vh-3.5rem)]">
          <Sidebar user={user} onLogout={onLogout} />
        </aside>
        {navOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setNavOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-lg">
              <Sidebar user={user} onLogout={onLogout} onNavigate={() => setNavOpen(false)} />
            </aside>
          </div>
        )}
        <main className="flex-1 min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
};

export default Shell;