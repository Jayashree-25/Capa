import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { login } from '../services/api';
import { setToken, setUser } from '../services/auth';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await login({ email, password });
      setToken(res.data.token);
      setUser(res.data.user);
      onLogin(res.data.user);
    } catch (err) {
      console.error('Login failed:', err.response?.data?.error || err.message);
      setError('Unable to sign in. Please check your email and password and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-10">
        <h1 className="text-3xl font-bold tracking-wide text-gray-900">CAPA</h1>
        <p className="text-sm text-gray-500 mt-1">Capacity, clearly managed.</p>

        <h2 className="text-base font-semibold text-gray-800 mt-8">Sign in to your workspace</h2>

        {error && (
          <div
            role="alert"
            className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md"
          >
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
              onChange={(e) => setPassword(e.target.value)}
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