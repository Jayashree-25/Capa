import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { getPeople, registerUser, getUsers } from '../services/api';

const inputClass =
  'w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

const Users = () => {
  const [people, setPeople] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('engineer');
  const [personId, setPersonId] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    Promise.all([getPeople(), getUsers()])
      .then(([peopleRes, usersRes]) => {
        setPeople(peopleRes.data);
        setUsers(usersRes.data);
        setLoading(false);
      })
      .catch(err => setError(err.response?.data?.error || err.message));
  };

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leads = people.filter(p => p.role === 'lead');
  const personOptions = role === 'lead' ? leads : people.filter(p => p.role !== 'lead');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (role === 'lead' && !personId) {
      setError('Select the lead person for this account.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await registerUser({ email, password, role, personId: personId || null });
      setEmail('');
      setPassword('');
      setPersonId('');
      setSuccess(`Account created for ${email.trim().toLowerCase()}.`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-4 text-center flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Users</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create login accounts for your team and see who has access.</p>
      </div>

      {error && (
        <div className="bg-red-100 text-red-800 p-3 rounded flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}
      {success && (
        <div className="bg-green-100 text-green-800 p-3 rounded flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')}>✕</button>
        </div>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">New account</h2>
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password (min 8 characters)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              minLength="8"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <div className="flex rounded-md border border-gray-300 overflow-hidden w-fit">
              {['engineer', 'lead'].map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setRole(option);
                    setPersonId('');
                  }}
                  className={`h-10 px-4 text-sm font-medium capitalize ${role === option ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Person</label>
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className={inputClass}
              required={role === 'lead'}
            >
              <option value="">{role === 'lead' ? 'Select the lead…' : 'No person — account only'}</option>
              {personOptions.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.team}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1.5">
              {role === 'lead'
                ? 'The account signs in with the selected lead\u2019s identity.'
                : 'Engineer accounts can sign in and view only their own assigned tasks.'}
            </p>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Account'}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Accounts ({users.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Email</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Person</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Role</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-100">
                  <td className="p-2.5 text-gray-800">{u.email}</td>
                  <td className="p-2.5 text-gray-600">{u.personName || '—'}</td>
                  <td className="p-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.role === 'boss' ? 'bg-gray-100 text-gray-700' : u.role === 'lead' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-2.5 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td className="p-2.5 text-gray-400" colSpan="4">No accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Users;