import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { createPerson } from '../services/api';

const inputClass =
  'w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

const PersonFormModal = ({ isOpen, onClose, onCreated, teams = [], people = [] }) => {
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [role, setRole] = useState('member');
  const [managerId, setManagerId] = useState('');
  const [weeklyCapacity, setWeeklyCapacity] = useState(40);
  const [customTeam, setCustomTeam] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const leads = people.filter(p => p.role === 'lead');

  const resetForm = () => {
    setName('');
    setTeam('');
    setRole('member');
    setManagerId('');
    setWeeklyCapacity(40);
    setCustomTeam('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalTeam = team === '__new__' ? customTeam : team;
    if (!finalTeam.trim()) {
      setError('Team is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await createPerson({
        name,
        team: finalTeam,
        weeklyCapacity: Number(weeklyCapacity),
        role,
        managerId: role === 'lead' ? null : (managerId || null)
      });
      resetForm();
      onCreated(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Add person">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Add Person</h2>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Team</label>
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a team…</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
              <option value="__new__">New team…</option>
            </select>
            {team === '__new__' && (
              <input
                type="text"
                value={customTeam}
                onChange={(e) => setCustomTeam(e.target.value)}
                placeholder="Team name"
                className={`${inputClass} mt-2`}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <div className="flex rounded-md border border-gray-300 overflow-hidden w-fit">
              {['member', 'lead'].map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setRole(option);
                    setManagerId('');
                  }}
                  className={`h-10 px-4 text-sm font-medium capitalize ${role === option ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reports to</label>
            {role === 'lead' ? (
              <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5">
                Leads report directly to the Boss.
              </p>
            ) : (
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className={inputClass}
              >
                <option value="">No manager — Solo</option>
                {leads.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Weekly capacity (hours)</label>
            <input
              type="number"
              min="1"
              max="168"
              value={weeklyCapacity}
              onChange={(e) => setWeeklyCapacity(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Person'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default PersonFormModal;