import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { createTask } from '../services/api';
import { weekToMonday, toISO } from '../utils/dateUtils';

const ChunkFormModal = ({ isOpen, onClose, onCreated, parentTask, people = [], currentMonday }) => {
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(8);
  const [week, setWeek] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && parentTask) {
      setTitle('');
      setAssigneeId('');
      setEstimatedHours(8);
      setError('');
    }
  }, [isOpen, parentTask]);

  useEffect(() => {
    if (isOpen && currentMonday) {
      setWeek(currentMonday);
    }
  }, [isOpen, currentMonday]);

  if (!parentTask) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const monday = weekToMonday(week);
    if (!monday) {
      setError('Please pick a valid week date.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await createTask({
        title,
        parentId: parentTask.id,
        assigneeId: assigneeId || null,
        estimatedHours: Number(estimatedHours),
        week: toISO(monday)
      });
      onCreated(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Add chunk">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Break into chunks</h2>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Parent task</label>
            <input
              type="text"
              value={parentTask.title}
              disabled
              className="w-full h-11 px-3.5 rounded-md border border-gray-300 bg-gray-100 text-sm text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Chunk title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
                required
              >
                <option value="">Select assignee…</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated hours</label>
              <input
                type="number"
                min="1"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Week (any day)</label>
            <input
              type="date"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
              required
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Chunk'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ChunkFormModal;