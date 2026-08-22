import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { Modal } from '../components/Modal';
import { getPeople, registerUser, getUsers, updateUser, deleteUser as deleteUserApi, resendSetupEmail } from '../services/api';

const inputClass =
  'w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

const USERS_PER_PAGE = 10;

const Users = () => {
  const [people, setPeople] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [team, setTeam] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [weeklyCapacity, setWeeklyCapacity] = useState(40);
  const [managerId, setManagerId] = useState('');

  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRefs = useRef({});
  const menuRef = useRef(null);

  const [editUser, setEditUser] = useState(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);

  const refresh = () => {
    Promise.all([getPeople(), getUsers()])
      .then(([peopleRes, usersRes]) => {
        setPeople(peopleRes.data);
        setUsers(usersRes.data);
        setLoading(false);
      })
      .catch(err => setError(err.response?.data?.error || err.message));
  };

  useEffect(() => { refresh(); }, []);

  const existingTeams = useMemo(() => {
    const s = new Set(people.map(p => p.team).filter(Boolean));
    return [...s].sort();
  }, [people]);

  const resolvedTeam = team === '__new' ? newTeam.trim() : team;

  const totalPages = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  const paginatedUsers = users.slice(
    (currentPage - 1) * USERS_PER_PAGE,
    currentPage * USERS_PER_PAGE
  );

  const availableLeads = useMemo(() => {
    return people.filter(p => {
      if (p.role !== 'lead') return false;
      if (p.status === 'inactive') return false;
      if (resolvedTeam && p.team !== resolvedTeam) return false;
      return true;
    });
  }, [people, resolvedTeam]);

  useEffect(() => {
    if (role === 'lead') {
      setManagerId('');
    } else if (managerId && !availableLeads.find(l => l.id === managerId)) {
      setManagerId('');
    }
  }, [role, resolvedTeam]);

  const resetForm = () => {
    setName('');
    setEmail('');
    setRole('member');
    setTeam('');
    setNewTeam('');
    setWeeklyCapacity(40);
    setManagerId('');
  };

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
      const payload = {
        email,
        role: role === 'member' ? 'engineer' : role,
        personName: name.trim(),
        personTeam: resolvedTeam,
        personWeeklyCapacity: Number(weeklyCapacity) || 40,
      };
      if (role === 'member' && managerId) {
        payload.managerId = managerId;
      }
      await registerUser(payload);
      resetForm();
      setCurrentPage(1);
      setSuccess('Team member added and login created for ' + email.trim().toLowerCase() + '. They will set their password on first sign-in.');
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const closeMenu = useCallback(() => setOpenMenuId(null), []);

  const toggleMenu = useCallback((userId) => {
    setOpenMenuId(prev => {
      if (prev === userId) return null;
      const btn = buttonRefs.current[userId];
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const menuHeight = 170;
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpward = spaceBelow < menuHeight + 8;
        setMenuPos({
          top: openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4,
          left: rect.right - 144
        });
      }
      return userId;
    });
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId, closeMenu]);

  const handleResendSetup = async (user) => {
    try {
      await resendSetupEmail(user.id);
      setError('');
      setSuccess('Setup email resent to ' + user.email);
      closeMenu();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      closeMenu();
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
          <button onClick={() => setError('')}>&#x2715;</button>
        </div>
      )}
      {success && (
        <div className="bg-green-100 text-green-800 p-3 rounded flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')}>&#x2715;</button>
        </div>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Add Team Member</h2>
        <p className="text-sm text-gray-500 mb-5">Create a person record and their login account in one step.</p>

        <form onSubmit={handleSubmit}>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-4">
            <div className="sm:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Person</h3>
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

            <div className="sm:col-span-2 mt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Role &amp; Organization</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <div className="flex rounded-md border border-gray-300 overflow-hidden w-fit">
                {[
                  { value: 'member', label: 'Member' },
                  { value: 'lead', label: 'Lead' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={'h-10 px-4 text-sm font-medium ' + (role === opt.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')}
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
                <option value="">Select a team...</option>
                {existingTeams.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="__new">+ New team...</option>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Weekly capacity</label>
              <div className="relative">
                <input
                  type="number"
                  value={weeklyCapacity}
                  onChange={(e) => setWeeklyCapacity(e.target.value)}
                  min="1"
                  max="168"
                  className={inputClass}
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">hours/week</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reports To</label>
              {role === 'lead' ? (
                <div className={'flex items-center bg-gray-50 cursor-not-allowed ' + inputClass}>
                  <span className="text-gray-500">Boss (organization level)</span>
                </div>
              ) : (
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Boss (no direct lead)</option>
                  {availableLeads.map(lead => (
                    <option key={lead.id} value={lead.id}>{lead.name} - {lead.team}</option>
                  ))}
                </select>
              )}
              {role === 'member' && resolvedTeam && availableLeads.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No leads in this team yet. Member will be solo (reports to Boss).</p>
              )}
            </div>

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
              {submitting ? 'Adding...' : 'Add Team Member'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{'Accounts (' + users.length + ')'}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Email</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Person</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Role</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Status</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Created</th>
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map(u => (
                <tr key={u.id} className="border-b border-gray-100">
                  <td className="p-2.5 text-gray-800">{u.email}</td>
                  <td className="p-2.5 text-gray-600">{u.personName || '---'}</td>
                  <td className="p-2.5">
                    <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (u.role === 'boss' ? 'bg-gray-100 text-gray-700' : u.role === 'lead' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700')}>
                      {u.role === 'engineer' ? 'Member' : u.role}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (u.needsPasswordSetup ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700')}>
                      {u.needsPasswordSetup ? 'Pending setup' : 'Active'}
                    </span>
                  </td>
                  <td className="p-2.5 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-2.5 text-right">
                    <button
                      ref={(el) => { buttonRefs.current[u.id] = el; }}
                      onClick={() => toggleMenu(u.id)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
                      aria-label="User actions"
                      title="User actions"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td className="p-2.5 text-gray-400" colSpan="6">No accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {users.length > USERS_PER_PAGE && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {((currentPage - 1) * USERS_PER_PAGE) + 1}–{Math.min(currentPage * USERS_PER_PAGE, users.length)} of {users.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={'w-9 h-9 text-sm rounded-md transition ' + (page === currentPage
                    ? 'bg-blue-600 text-white font-medium'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50')}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </Card>

      {openMenuId && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
        >
          {(() => {
            const user = users.find(u => u.id === openMenuId);
            if (!user) return null;
            return (
              <>
                <button
                  onClick={() => { setEditUser(user); closeMenu(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition text-left"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
                {user.needsPasswordSetup && (
                  <button
                    onClick={() => { handleResendSetup(user); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition text-left"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Resend setup email
                  </button>
                )}
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { setDeleteUserTarget(user); closeMenu(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition text-left"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              </>
            );
          })()}
        </div>,
        document.body
      )}

      {editUser && (
        <EditUserModal
          isOpen={!!editUser}
          onClose={() => setEditUser(null)}
          user={editUser}
          people={people}
          onUpdated={() => { setEditUser(null); refresh(); }}
        />
      )}

      {deleteUserTarget && (
        <DeleteUserModal
          isOpen={!!deleteUserTarget}
          onClose={() => setDeleteUserTarget(null)}
          user={deleteUserTarget}
          onDeleted={() => {
            setDeleteUserTarget(null);
            refresh();
            const maxPage = Math.max(1, Math.ceil((users.length - 1) / USERS_PER_PAGE));
            if (currentPage > maxPage) {
              setCurrentPage(maxPage);
            }
          }}
        />
      )}
    </div>
  );
};

const EditUserModal = ({ isOpen, onClose, user, people, onUpdated }) => {
  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const person = people.find(p => p.email === user.email) || {};
  const [name, setName] = useState(person.name || user.personName || '');
  const [emailVal, setEmailVal] = useState(user.email || '');
  const [roleVal, setRoleVal] = useState(user.role === 'engineer' ? 'member' : (user.role === 'lead' ? 'lead' : 'member'));
  const [team, setTeam] = useState(person.team || '');
  const [capacity, setCapacity] = useState(person.weeklyCapacity || 40);
  const [managerIdVal, setManagerIdVal] = useState(person.managerId || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const existingTeams = useMemo(() => {
    const s = new Set(people.map(p => p.team).filter(Boolean));
    return [...s].sort();
  }, [people]);

  const availableLeads = useMemo(() => {
    return people.filter(p => {
      if (p.role !== 'lead') return false;
      if (p.status === 'inactive') return false;
      if (team && p.team !== team) return false;
      return true;
    });
  }, [people, team]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await updateUser(user.id, {
        name: name.trim(),
        email: emailVal.trim(),
        role: roleVal === 'member' ? 'engineer' : roleVal,
        team: team.trim(),
        weeklyCapacity: Number(capacity),
        managerId: roleVal === 'member' ? (managerIdVal || undefined) : undefined,
      });
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Edit user">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Edit User</h2>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input type="email" value={emailVal} onChange={e => setEmailVal(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <div className="flex rounded-md border border-gray-300 overflow-hidden w-fit">
              {[
                { value: 'member', label: 'Member' },
                { value: 'lead', label: 'Lead' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRoleVal(opt.value)}
                  className={'h-10 px-4 text-sm font-medium ' + (roleVal === opt.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Team</label>
            <select value={team} onChange={e => setTeam(e.target.value)} className={inputClass} required>
              <option value="">Select a team...</option>
              {existingTeams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Weekly capacity (hours)</label>
            <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} min="1" max="168" className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reports To</label>
            {roleVal === 'lead' ? (
              <div className={'flex items-center bg-gray-50 cursor-not-allowed ' + inputClass}>
                <span className="text-gray-500">Boss (organization level)</span>
              </div>
            ) : (
              <select value={managerIdVal} onChange={e => setManagerIdVal(e.target.value)} className={inputClass}>
                <option value="">Boss (no direct lead)</option>
                {availableLeads.map(lead => (
                  <option key={lead.id} value={lead.id}>{lead.name} - {lead.team}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

const DeleteUserModal = ({ isOpen, onClose, user, onDeleted }) => {
  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setSubmitting(true);
    setError('');
    try {
      await deleteUserApi(user.id);
      onDeleted();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Delete user">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Delete User</h2>
        <p className="text-sm text-gray-600">
          This will remove <span className="font-semibold">{user.email}</span>'s access to CAPA.
        </p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}
        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={submitting} onClick={handleDelete}>
            {submitting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default Users;
