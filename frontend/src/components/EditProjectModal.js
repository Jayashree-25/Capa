import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

const EditProjectModal = ({ project, isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    phases: { discovery: {}, build: {}, testing: {} }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize form with project data
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        phases: project.phases || { discovery: {}, build: {}, testing: {} }
      });
    }
  }, [project]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handlePhaseChange = (phase, field, value) => {
    setFormData({
      ...formData,
      phases: {
        ...formData.phases,
        [phase]: { 
          ...formData.phases[phase], 
          [field]: field === 'teamMembers' ? Number(value) : value // Convert to number
        }
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:3001/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phases: formData.phases
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `Update failed (${response.status})`);
      }

      onSuccess(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update project. Please try again.');
      console.error('Update failed:', {
        projectId: project.id,
        error: err.message,
        formData
      });
    } finally {
      setLoading(false);
    }
  };

  if (!project) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">Edit Project</h2>
        
        {error && <div className="text-red-500">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          {['discovery', 'build', 'testing'].map((phase) => (
            <div key={phase} className="border p-4 rounded">
              <h3 className="font-medium capitalize mb-2">{phase} Phase</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Start (MMYYYY)</label>
                  <input
                    type="text"
                    value={formData.phases[phase]?.start || ''}
                    onChange={(e) => handlePhaseChange(phase, 'start', e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">End (MMYYYY)</label>
                  <input
                    type="text"
                    value={formData.phases[phase]?.end || ''}
                    onChange={(e) => handlePhaseChange(phase, 'end', e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              </div>

              <div className="mt-2">
                <label className="block text-sm text-gray-600 mb-1">Team Members</label>
                <input
                  type="number"
                  value={formData.phases[phase]?.teamMembers || ''}
                  onChange={(e) => handlePhaseChange(phase, 'teamMembers', e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                  min="1"
                />
              </div>
            </div>
          ))}

          <div className="flex justify-end space-x-2 pt-4">
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
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default EditProjectModal;
