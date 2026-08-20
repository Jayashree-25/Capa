import React from 'react';
import { Card } from '../components/Card';

const ROLE_BADGE = {
  boss: 'bg-gray-900 text-white',
  lead: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  engineer: 'bg-green-100 text-green-800'
};

const Profile = ({ user }) => {
  const displayRole = user.personRole || user.role;
  const rows = [
    { label: 'Name', value: user.personName || '—' },
    { label: 'Email', value: user.email },
    {
      label: 'Role',
      value: (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_BADGE[displayRole] || 'bg-gray-100 text-gray-600'}`}>
          {displayRole}
        </span>
      )
    }
  ];

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-800">Profile</h1>
      <p className="text-sm text-gray-500 mt-0.5 mb-4">Your account details.</p>
      <Card>
        <dl className="divide-y divide-gray-100">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between py-3.5">
              <dt className="text-sm font-medium text-gray-500">{row.label}</dt>
              <dd className="text-sm font-medium text-gray-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
};

export default Profile;