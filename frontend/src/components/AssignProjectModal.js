import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { updateProject } from '../services/api';

const inputClass =
  'w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

const AssignProjectModal = ({ isOpen, onClose, onAssigned, projects = [], leads = [] }) => {
  const [projectId, setProjectId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProjectId('');
      setOwnerId('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId) {
      setError('Please select a project.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await updateProject(projectId, { ownerId: ownerId || null });
      onAssigned(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Assign project">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Assign Project</h2>
        <p className="text-sm text-gray-500">Assign a project to a lead. The lead is then responsible for creating the tasks and chunks under it.</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select project…</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.ownerName ? ` — assigned to ${p.ownerName}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Lead</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className={inputClass}
            >
              <option value="">No lead — Unassigned</option>
              {leads.map(p => <option key={p.id} value={p.id}>{p.name} — {p.team}</option>)}
            </select>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Assign Project'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AssignProjectModal;