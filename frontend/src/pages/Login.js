import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { login, setPassword } from '../services/api';
import { setToken, setUser } from '../services/auth';

const inputClass =
  'w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword_] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Password-setup state
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [setupToken, setSetupToken] = useState(null);
  const [setupUser, setSetupUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await login({ email, password });
      if (res.data.needsPasswordSetup) {
        setSetupToken(res.data.setupToken);
        setSetupUser(res.data.user);
        setNeedsPasswordSetup(true);
        setError('');
      } else {
        setToken(res.data.token);
        setUser(res.data.user);
        onLogin(res.data.user);
      }
    } catch (err) {
      setError('Unable to sign in. Please check your email and password and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
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
      const res = await setPassword({ setupToken, newPassword });
      setToken(res.data.token);
      setUser(res.data.user);
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (needsPasswordSetup) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-10">
          <h1 className="text-3xl font-bold tracking-wide text-gray-900">CAPA</h1>
          <p className="text-sm text-gray-500 mt-1">Capacity, clearly managed.</p>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-blue-800">Set your password</h2>
            <p className="text-xs text-blue-700 mt-1">
              Welcome, {setupUser?.personName || setupUser?.email}. Please create a password to access your account.
            </p>
          </div>

          {error && (
            <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSetPassword} className="mt-6 space-y-5">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                New password (min 8 characters)
              </label>
              <div className="relative">
                <input
                  id="new-password"
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
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
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
                  Setting password…
                </span>
              ) : (
                'Set Password & Sign In'
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-10">
        <h1 className="text-3xl font-bold tracking-wide text-gray-900">CAPA</h1>
        <p className="text-sm text-gray-500 mt-1">Capacity, clearly managed.</p>

        <h2 className="text-base font-semibold text-gray-800 mt-8">Sign in to your workspace</h2>

        {error && (
          <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Work email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={inputClass}
              autoComplete="email"
              autoFocus
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword_(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-md text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner className="w-4 h-4" />
                Signing in…
              </span>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
