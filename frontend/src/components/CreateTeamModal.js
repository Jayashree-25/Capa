import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export const CreateTeamModal = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [memberCount, setMemberCount] = useState(1);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, memberCount }),
      });
      if (!response.ok) throw new Error('Failed to create team');
      onSuccess(); // Refresh teams list
      onClose(); // Close modal
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="create-team-modal">
        <h2>Create Team</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Team Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Member Count</label>
            <input
              type="number"
              min="1"
              value={memberCount}
              onChange={(e) => setMemberCount(Number(e.target.value))}
              required
            />
          </div>
          <div className="modal-actions">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="btn-primary">
              Create Team
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
