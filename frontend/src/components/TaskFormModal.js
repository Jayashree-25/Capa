import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { createTask } from '../services/api';
import { weekToMonday, toISO } from '../utils/dateUtils';

const TaskFormModal = ({ isOpen, onClose, onCreated, people = [], projects = [], currentMonday, assigneeLock = null }) => {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(8);
  const [week, setWeek] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && currentMonday) {
      setWeek(currentMonday);
    }
  }, [isOpen, currentMonday]);

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
        projectId,
        assigneeId: assigneeLock || assigneeId || null,
        estimatedHours: Number(estimatedHours),
        week: toISO(monday)
      });
      setTitle('');
      setEstimatedHours(8);
      onCreated(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Add task">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">Add Task</h2>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Select project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
              {assigneeLock ? (
                <input
                  type="text"
                  value={people.find(p => p.id === assigneeLock)?.name || ''}
                  disabled
                  className="w-full p-2 border rounded bg-gray-100 text-gray-600"
                />
              ) : (
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Unassigned</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated hours</label>
              <input
                type="number"
                min="1"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Week (any day)</label>
              <input
                type="date"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" onClick={onClose} className="bg-gray-300 hover:bg-gray-400">Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Task'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default TaskFormModal;