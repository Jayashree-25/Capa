import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '../components/Spinner';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { getPeople, updatePerson, deletePerson } from '../services/api';

const inputClass =
  'w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

const People = () => {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Action menu
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRefs = useRef({});
  const menuRef = useRef(null);

  // Modals
  const [editPerson, setEditPerson] = useState(null);
  const [rolePerson, setRolePerson] = useState(null);

  const closeMenu = useCallback(() => setOpenMenuId(null), []);

  const toggleMenu = useCallback((personId) => {
    setOpenMenuId(prev => {
      if (prev === personId) return null;
      const btn = buttonRefs.current[personId];
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const menuHeight = 130;
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpward = spaceBelow < menuHeight + 8;
        setMenuPos({
          top: openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4,
          left: rect.right - 144
        });
      }
      return personId;
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

  const load = () => {
    getPeople()
      .then(res => {
        setPeople(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || err.message);
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  const teams = [...new Set(people.map(p => p.team).filter(Boolean))].sort();

  const filtered = people.filter(p => {
    if (roleFilter !== 'all' && p.role !== roleFilter) return false;
    if (teamFilter !== 'all' && p.team !== teamFilter) return false;
    if (statusFilter !== 'all') return false; // all people are active for now
    return true;
  });

  const hasFilters = roleFilter !== 'all' || teamFilter !== 'all' || statusFilter !== 'all';

  const handleDelete = async (person) => {
    if (!window.confirm(`Delete person "${person.name}"? Tasks must be reassigned first.`)) return;
    try {
      await deletePerson(person.id);
      setError(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">People</h1>
          <p className="text-sm text-gray-500 mt-0.5">Team members, roles, and reporting lines.</p>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={() => { setRoleFilter('all'); setTeamFilter('all'); setStatusFilter('all'); }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
          <div className="flex items-center gap-2 text-sm">
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="h-9 px-2 rounded-md border border-gray-300 bg-white text-gray-700 focus:border-blue-500 focus:outline-none">
              <option value="all">All roles</option>
              <option value="lead">Leads</option>
              <option value="member">Members</option>
            </select>
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="h-9 px-2 rounded-md border border-gray-300 bg-white text-gray-700 focus:border-blue-500 focus:outline-none">
              <option value="all">All teams</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-2 rounded-md border border-gray-300 bg-white text-gray-700 focus:border-blue-500 focus:outline-none">
              <option value="all">All status</option>
              <option value="active">Active</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Person</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Role</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Team</th>
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Capacity</th>
                <th className="text-center p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Status</th>
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(person => (
                <tr key={person.id} className="border-b border-gray-100">
                  <td className="p-2.5 font-semibold text-gray-900">{person.name}</td>
                  <td className="p-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      person.role === 'lead' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {person.role === 'lead' ? 'Lead' : 'Member'}
                    </span>
                  </td>
                  <td className="p-2.5 text-gray-700">{person.team}</td>
                  <td className="p-2.5 text-right text-gray-700">{person.weeklyCapacity}h</td>
                  <td className="p-2.5 text-center">
                    <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Active</span>
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      ref={(el) => { buttonRefs.current[person.id] = el; }}
                      onClick={() => toggleMenu(person.id)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
                      aria-label="Person actions"
                      title="Person actions"
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    {hasFilters ? 'No people match the selected filters.' : 'No people found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openMenuId && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
        >
          {(() => {
            const person = people.find(p => p.id === openMenuId);
            if (!person) return null;
            return (
              <>
                <button
                  onClick={() => { setEditPerson(person); closeMenu(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition text-left"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => { setRolePerson(person); closeMenu(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition text-left"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Change role
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { handleDelete(person); closeMenu(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition text-left"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Remove
                </button>
              </>
            );
          })()}
        </div>,
        document.body
      )}

      {editPerson && (
        <EditPersonModal
          isOpen={!!editPerson}
          onClose={() => setEditPerson(null)}
          person={editPerson}
          onUpdated={() => { setEditPerson(null); load(); }}
        />
      )}

      {rolePerson && (
        <ChangeRoleModal
          isOpen={!!rolePerson}
          onClose={() => setRolePerson(null)}
          person={rolePerson}
          people={people}
          onUpdated={() => { setRolePerson(null); load(); }}
        />
      )}
    </div>
  );
};

// ---------- Edit Person Modal ----------

const EditPersonModal = ({ isOpen, onClose, person, onUpdated }) => {
  const [name, setName] = useState(person.name);
  const [team, setTeam] = useState(person.team);
  const [capacity, setCapacity] = useState(person.weeklyCapacity);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await updatePerson(person.id, {
        name: name.trim(),
        team: team.trim(),
        weeklyCapacity: Number(capacity)
      });
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Edit person">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Edit Person</h2>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Team</label>
            <input type="text" value={team} onChange={e => setTeam(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Weekly capacity (hours)</label>
            <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} min="1" max="168" className={inputClass} required />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

// ---------- Change Role Modal ----------

const ChangeRoleModal = ({ isOpen, onClose, person, people, onUpdated }) => {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newLeadId, setNewLeadId] = useState('');

  const isCurrentlyLead = person.role === 'lead';
  const targetRole = isCurrentlyLead ? 'member' : 'lead';

  // For lead→member: find other members in the same team who could become lead
  const potentialLeads = people.filter(p =>
    p.id !== person.id && p.team === person.team && p.role === 'member'
  );

  // Check if this lead has reports
  const hasReports = people.some(p => p.managerId === person.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (isCurrentlyLead && hasReports) {
        // Need to reassign reports first
        if (!newLeadId) {
          setError('This lead has team members. Select a new lead before converting.');
          setSubmitting(false);
          return;
        }
        // First reassign all reports to the new lead
        const reports = people.filter(p => p.managerId === person.id);
        for (const report of reports) {
          await updatePerson(report.id, { managerId: newLeadId });
        }
      }

      // Now change the role
      await updatePerson(person.id, { role: targetRole });
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Change role">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Change Role</h2>
        <p className="text-sm text-gray-600">
          Convert <span className="font-semibold">{person.name}</span> from{' '}
          <span className="font-semibold">{isCurrentlyLead ? 'Lead' : 'Member'}</span> to{' '}
          <span className="font-semibold">{targetRole}</span>.
        </p>

        {isCurrentlyLead && hasReports && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-md">
            <p className="font-medium mb-1">This lead has team members reporting to them.</p>
            <p className="mb-2">Select a new lead for the team before converting:</p>
            <select
              value={newLeadId}
              onChange={e => setNewLeadId(e.target.value)}
              className={`${inputClass} mt-1`}
            >
              <option value="">Select a new lead…</option>
              {potentialLeads.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {potentialLeads.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No eligible members in this team. Create a new member first.</p>
            )}
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}

        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={submitting || (isCurrentlyLead && hasReports && !newLeadId)}
            onClick={handleSubmit}
          >
            {submitting ? 'Saving…' : `Convert to ${targetRole}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default People;
