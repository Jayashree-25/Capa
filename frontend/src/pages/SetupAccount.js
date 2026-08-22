import React, { useState, useEffect } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { setPassword } from '../services/api';

const inputClass =
  'w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

const SetupAccount = () => {
  const location = useLocation();
  const history = useHistory();
  const token = new URLSearchParams(location.search).get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No setup link provided. Please contact your admin for a new link.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await setPassword({ setupToken: token, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-10 text-center">
          <h1 className="text-3xl font-bold tracking-wide text-gray-900">CAPA</h1>
          <p className="text-sm text-gray-500 mt-1">Capacity, clearly managed.</p>

          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-green-800">Password set successfully</h2>
            <p className="text-xs text-green-700 mt-1">
              You can now sign in with your email and new password.
            </p>
          </div>

          <button
            onClick={() => history.push('/login')}
            className="mt-6 w-full h-11 rounded-md text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-10">
        <h1 className="text-3xl font-bold tracking-wide text-gray-900">CAPA</h1>
        <p className="text-sm text-gray-500 mt-1">Capacity, clearly managed.</p>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-blue-800">Set up your account</h2>
          <p className="text-xs text-blue-700 mt-1">
            Create a password to access your CAPA account.
          </p>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {!token ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">Invalid setup link.</p>
            <button
              onClick={() => history.push('/login')}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                New password (min 8 characters)
              </label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                  autoFocus
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {showNewPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {showConfirmPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-md text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Spinner className="w-4 h-4" />
                  Setting password...
                </span>
              ) : (
                'Set Password'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SetupAccount;
