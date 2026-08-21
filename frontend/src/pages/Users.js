import React, { useState, useEffect, useMemo } from 'react';
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
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('engineer');
  const [team, setTeam] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [weeklyCapacity, setWeeklyCapacity] = useState(40);

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

  const existingTeams = useMemo(() => {
    const set = new Set(people.map(p => p.team).filter(Boolean));
    return [...set].sort();
  }, [people]);

  const resolvedTeam = team === '__new' ? newTeam.trim() : team;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resolvedTeam) {
      setError('Please select or enter a team.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await registerUser({
        email,
        role,
        personName: name.trim(),
        personTeam: resolvedTeam,
        personWeeklyCapacity: Number(weeklyCapacity) || 40,
      });
      setName('');
      setEmail('');
      setRole('engineer');
      setTeam('');
      setNewTeam('');
      setWeeklyCapacity(40);
      setSuccess(`Team member added and login created for ${email.trim().toLowerCase()}. They will set their password on first sign-in.`);
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
        <p className="text-sm text-gray-500 mt-0.5">Manage team members and their login access.</p>
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
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Add Person</h2>
        <p className="text-sm text-gray-500 mb-5">Add a team member and create their login access in one step.</p>

        <form onSubmit={handleSubmit}>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-4">
            {/* Personal Information */}
            <div className="sm:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Personal Information</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email / Login ID</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <div className="flex rounded-md border border-gray-300 overflow-hidden w-fit">
                {[
                  { value: 'engineer', label: 'Engineer / Member' },
                  { value: 'lead', label: 'Lead' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`h-10 px-4 text-sm font-medium ${role === opt.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Team</label>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className={inputClass}
                required={!newTeam.trim()}
              >
                <option value="">Select a team…</option>
                {existingTeams.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="__new">+ New team…</option>
              </select>
            </div>
            {team === '__new' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New team name</label>
                <input
                  type="text"
                  value={newTeam}
                  onChange={(e) => setNewTeam(e.target.value)}
                  placeholder="e.g. DevOps"
                  className={inputClass}
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Weekly capacity (hours)</label>
              <input
                type="number"
                value={weeklyCapacity}
                onChange={(e) => setWeeklyCapacity(e.target.value)}
                min="1"
                max="168"
                className={inputClass}
                required
              />
            </div>

            {/* Account Access */}
            <div className="sm:col-span-2 mt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Account Access</h3>
              <p className="text-sm text-gray-500">
                A login account will be created with <span className="font-medium text-gray-700">{email || 'the email above'}</span>.
                The person will set their own password when they first sign in.
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Person'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Accounts ({users.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Email</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Person</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Role</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Status</th>
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
                  <td className="p-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.needsPasswordSetup ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                      {u.needsPasswordSetup ? 'Pending setup' : 'Active'}
                    </span>
                  </td>
                  <td className="p-2.5 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td className="p-2.5 text-gray-400" colSpan="5">No accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Users;
