import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { createPerson } from '../services/api';

const PersonFormModal = ({ isOpen, onClose, onCreated, teams = [] }) => {
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [weeklyCapacity, setWeeklyCapacity] = useState(40);
  const [customTeam, setCustomTeam] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setTeam('');
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
      const response = await createPerson({ name, team: finalTeam, weeklyCapacity: Number(weeklyCapacity) });
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
        <h2 className="text-2xl font-bold text-gray-800">Add Person</h2>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="w-full p-2 border rounded"
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
                className="w-full p-2 border rounded mt-2"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weekly capacity (hours)</label>
            <input
              type="number"
              min="1"
              max="168"
              value={weeklyCapacity}
              onChange={(e) => setWeeklyCapacity(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" onClick={onClose} className="bg-gray-300 hover:bg-gray-400">Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Person'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default PersonFormModal;