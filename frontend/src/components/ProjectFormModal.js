import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { createProject } from '../services/api';

const ProjectFormModal = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await createProject({ name });
      setName('');
      onCreated(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Add project">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">Add Project</h2>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" onClick={onClose} className="bg-gray-300 hover:bg-gray-400">Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Project'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ProjectFormModal;