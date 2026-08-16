import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { createTask } from '../services/api';
import { weekToMonday, toISO } from '../utils/dateUtils';

const TaskFormModal = ({ isOpen, onClose, onCreated, people = [], projects = [], currentMonday, assigneeLock = null, isBoss = false }) => {
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

  const leads = people.filter(p => p.role === 'lead');
  const solo = people.filter(p => p.role !== 'lead' && !p.managerId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Add task">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Add Task</h2>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Task title</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
                required
              >
                <option value="">Select project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assignee</label>
              {assigneeLock ? (
                <input
                  type="text"
                  value={people.find(p => p.id === assigneeLock)?.name || ''}
                  disabled
                  className="w-full h-11 px-3.5 rounded-md border border-gray-300 bg-gray-100 text-sm text-gray-600"
                />
              ) : (
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
                >
                  <option value="">Unassigned</option>
                  {isBoss ? (
                    <>
                      {leads.length > 0 && (
                        <optgroup label="Leads">
                          {leads.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}
                        </optgroup>
                      )}
                      {solo.length > 0 && (
                        <optgroup label="Solo">
                          {solo.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    people.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)
                  )}
                </select>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Task'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default TaskFormModal;