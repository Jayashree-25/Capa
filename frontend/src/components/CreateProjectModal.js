import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export const CreateProjectModal = ({
  isOpen,
  onClose,
  onCreateSuccess
}) => {
  const [formData, setFormData] = useState({
    name: '',
    phases: {
      discovery: { start: '', end: '', teamMembers: 0 },
      build: { start: '', end: '', teamMembers: 0 },
      testing: { start: '', end: '', teamMembers: 0 }
    }
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }

    // Validate phases
    Object.entries(formData.phases).forEach(([phase, details]) => {
      if (!/^\\d{6}$/.test(details.start)) {
        newErrors[`${phase}Start`] = 'Start date must be in MMYYYY format';
      }
      if (!/^\\d{6}$/.test(details.end)) {
        newErrors[`${phase}End`] = 'End date must be in MMYYYY format';
      }
      if (details.teamMembers < 0) {
        newErrors[`${phase}TeamMembers`] = 'Team members cannot be negative';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setApiError(null);

    try {
      const response = await fetch('http://localhost:3001/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const newProject = await response.json();
      onCreateSuccess(newProject);
      resetForm();
      onClose();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhaseChange = (phase, field, value) => {
    setFormData(prev => ({
      ...prev,
      phases: {
        ...prev.phases,
        [phase]: {
          ...prev.phases[phase],
          [field]: field === 'teamMembers' ? parseInt(value) || 0 : value
        }
      }
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phases: {
        discovery: { start: '', end: '', teamMembers: 0 },
        build: { start: '', end: '', teamMembers: 0 },
        testing: { start: '', end: '', teamMembers: 0 }
      }
    });
    setErrors({});
    setApiError(null);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" // Full-screen overlay
    >
      <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Create Project</h2>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {apiError && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                name="name"
                className={`w-full p-2 border rounded ${errors.name ? 'border-red-500' : ''}`}
                value={formData.name}
                onChange={handleChange}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {['discovery', 'build', 'testing'].map(phase => (
              <div key={phase} className="border p-4 rounded-lg bg-gray-50">
                <h3 className="font-medium text-lg capitalize mb-3">{phase} Phase</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Start (MMYYYY) *</label>
                    <input
                      type="text"
                      placeholder="012024"
                      className={`w-full p-2 border rounded ${errors[`${phase}Start`] ? 'border-red-500' : ''}`}
                      value={formData.phases[phase].start}
                      onChange={(e) => handlePhaseChange(phase, 'start', e.target.value)}
                    />
                    {errors[`${phase}Start`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`${phase}Start`]}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">End (MMYYYY) *</label>
                    <input
                      type="text"
                      placeholder="022024"
                      className={`w-full p-2 border rounded ${errors[`${phase}End`] ? 'border-red-500' : ''}`}
                      value={formData.phases[phase].end}
                      onChange={(e) => handlePhaseChange(phase, 'end', e.target.value)}
                    />
                    {errors[`${phase}End`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`${phase}End`]}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Team Members *</label>
                    <input
                      type="number"
                      min="0"
                      className={`w-full p-2 border rounded ${errors[`${phase}TeamMembers`] ? 'border-red-500' : ''}`}
                      value={formData.phases[phase].teamMembers}
                      onChange={(e) => handlePhaseChange(phase, 'teamMembers', e.target.value)}
                    />
                    {errors[`${phase}TeamMembers`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`${phase}TeamMembers`]}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </form>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
          <Button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="project-form"
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
