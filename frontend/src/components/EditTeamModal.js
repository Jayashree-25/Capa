import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export const EditTeamModal = ({ team, isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [memberCount, setMemberCount] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    if (team) {
      setName(team.name);
      setMemberCount(team.memberCount);
    }
  }, [team, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:3001/api/teams/${encodeURIComponent(team.name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, memberCount }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update team');
      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">Edit Team</h2>
        {error && <div className="text-red-500">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Member Count</label>
            <input
              type="number"
              min="1"
              value={memberCount}
              onChange={(e) => setMemberCount(Number(e.target.value))}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
