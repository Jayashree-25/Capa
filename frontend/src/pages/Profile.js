import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { updateProfile } from '../services/api';

const ROLE_BADGE = {
  boss: 'bg-gray-900 text-white',
  lead: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  engineer: 'bg-green-100 text-green-800'
};

const inputClass =
  'w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

const Profile = ({ user, onUserUpdated }) => {
  const displayRole = user.personRole || user.role;
  const [name, setName] = useState(user.displayName || user.personName || '');
  const [email, setEmail] = useState(user.email || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(user.displayName || user.personName || '');
    setEmail(user.email || '');
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await updateProfile({ name, email });
      onUserUpdated(res.data);
      setDirty(false);
      setSuccess('Profile updated.');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user.displayName || user.personName || '');
    setEmail(user.email || '');
    setError('');
    setSuccess('');
    setDirty(false);
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-800">Profile</h1>
      <p className="text-sm text-gray-500 mt-0.5 mb-4">Your account details.</p>
      <Card>
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-md">{success}</div>
        )}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
        )}
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setDirty(true); }}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setDirty(true); }}
              className={inputClass}
              required
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1.5">Role</span>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_BADGE[displayRole] || 'bg-gray-100 text-gray-600'}`}>
              {displayRole}
            </span>
            <p className="text-xs text-gray-400 mt-1.5">Role cannot be changed.</p>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Profile;