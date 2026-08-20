import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { updateProfile, changePassword } from '../services/api';

const ROLE_BADGE = {
  boss: 'bg-gray-900 text-white',
  lead: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  engineer: 'bg-green-100 text-green-800'
};

const inputClass =
  'w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

const FieldIcon = ({ d }) => (
  <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const FieldLabel = ({ icon, children }) => (
  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
    <FieldIcon d={icon} />
    {children}
  </label>
);

const PasswordInput = ({ id, value, onChange, autoComplete }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className={`${inputClass} pr-10`}
        autoComplete={autoComplete}
        required
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <path d="M1 1l22 22" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
};

const Profile = ({ user, onUserUpdated }) => {
  const displayRole = user.personRole || user.role;
  const displayName = user.displayName || user.personName || '';
  const initial = (displayName || user.email || '?').charAt(0).toUpperCase();
  const [name, setName] = useState(user.displayName || user.personName || '');
  const [email, setEmail] = useState(user.email || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dirty, setDirty] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

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

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');
    if (newPassword.length < 8) {
      setPassError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Passwords do not match.');
      return;
    }
    setPassSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPassSuccess('Password changed successfully.');
    } catch (err) {
      setPassError(err.response?.data?.error || err.message);
    } finally {
      setPassSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-gray-800">Profile</h1>
      <p className="text-sm text-gray-500 mt-0.5 mb-5">Manage your account information and security preferences.</p>

      <div className="flex items-center gap-4 mb-6 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-semibold select-none">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 truncate">{displayName || user.email}</div>
          <div className="text-sm text-gray-500 capitalize">
            {displayRole} <span className="text-gray-300 mx-1">·</span> {user.email}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <h2 className="text-lg font-semibold text-gray-800">Personal Information</h2>
          <p className="text-sm text-gray-500 mt-0.5 mb-5">Manage the information associated with your account.</p>
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-md">{success}</div>
          )}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
          )}
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <FieldLabel icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z">
                Name
              </FieldLabel>
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
              <FieldLabel icon="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm0 2v.01l8 6 8-6V6H4zm0 2v10h16V8l-8 6-8-6z">
                Email
              </FieldLabel>
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
              <FieldLabel icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z">Role</FieldLabel>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${ROLE_BADGE[displayRole] || 'bg-gray-100 text-gray-600'}`}>
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

        <Card>
          <h2 className="text-lg font-semibold text-gray-800">Security</h2>
          <p className="text-sm text-gray-500 mt-0.5">Protect your account by keeping your password secure.</p>
          <div className="flex items-center gap-2 mt-4 mb-5">
            <span className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span className="text-xs font-medium text-gray-600">Account security</span>
          </div>
          {passSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-md">{passSuccess}</div>
          )}
          {passError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{passError}</div>
          )}
          <form onSubmit={handlePasswordSave} className="space-y-5">
            <div>
              <FieldLabel icon="M5 11h14v10H5zM7 11V7a5 5 0 0 1 10 0v4">Current password</FieldLabel>
              <PasswordInput
                id="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <FieldLabel icon="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zM8 11V7a4 4 0 0 1 8 0v4">New password</FieldLabel>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-400 mt-1.5">Minimum 8 characters</p>
            </div>
            <div>
              <FieldLabel icon="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zM8 11V7a4 4 0 0 1 8 0v4">Confirm new password</FieldLabel>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={passSaving}>
                {passSaving ? 'Changing…' : 'Change password'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Profile;