import React, { useState, useCallback } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Spinner } from './Spinner';
import PropTypes from 'prop-types';

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

  const validateForm = useCallback(() => {
    const newErrors = {};
    
    // Validate project name
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Project name must be at least 3 characters long';
    }

    // Validate phases
    Object.entries(formData.phases).forEach(([phase, details]) => {
      // Validate start date
      if (!details.start.trim()) {
        newErrors[`${phase}Start`] = 'Start date is required';
      } else if (!/^(0[1-9]|1[0-2])(20[2-9][0-9]|2[1-9][0-9]{2}|[3-9][0-9]{3})$/.test(details.start)) {
        newErrors[`${phase}Start`] = 'Start date must be in MMYYYY format (01-12 for month, 2023+ for year)';
      }

      // Validate end date
      if (!details.end.trim()) {
        newErrors[`${phase}End`] = 'End date is required';
      } else if (!/^(0[1-9]|1[0-2])(20[2-9][0-9]|2[1-9][0-9]{2}|[3-9][0-9]{3})$/.test(details.end)) {
        newErrors[`${phase}End`] = 'End date must be in MMYYYY format (01-12 for month, 2023+ for year)';
      }

      // Validate team members
      if (details.teamMembers < 0) {
        newErrors[`${phase}TeamMembers`] = 'Team members cannot be negative';
      } else if (details.teamMembers > 100) {
        newErrors[`${phase}TeamMembers`] = 'Team members cannot exceed 100';
      }

      // Validate start and end date logic
      if (details.start && details.end) {
        const startMonth = parseInt(details.start.substring(0, 2), 10);
        const startYear = parseInt(details.start.substring(2), 10);
        const endMonth = parseInt(details.end.substring(0, 2), 10);
        const endYear = parseInt(details.end.substring(2), 10);
        
        if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) {
          newErrors[`${phase}End`] = 'End date must be in or after the start month';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Block duplicate submissions
    if (isSubmitting) {
      console.warn('Submission already in progress');
      return;
    }
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setApiError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        phases: {
          discovery: {
            start: formData.phases.discovery.start,
            end: formData.phases.discovery.end,
            teamMembers: Number(formData.phases.discovery.teamMembers)
          },
          build: {
            start: formData.phases.build.start,
            end: formData.phases.build.end,
            teamMembers: Number(formData.phases.build.teamMembers)
          },
          testing: {
            start: formData.phases.testing.start,
            end: formData.phases.testing.end,
            teamMembers: Number(formData.phases.testing.teamMembers)
          }
        }
      };
      console.log('Submitting payload:', payload); // Debug log
      
      const response = await fetch('http://localhost:3001/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const newProject = await response.json();
      console.log('Server response:', newProject);
      
      if (onCreateSuccess) onCreateSuccess(newProject);
      resetForm();
      onClose();
      
    } catch (err) {
      console.error('Submission failed:', err);
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

  const handleClose = () => {
    if (validateForm()) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      disableClose={isSubmitting}
      ariaLabel="Create new project"
    >
      <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Create Project</h2>
        </div>

        <div className="p-6 space-y-4">
          {apiError && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 rounded flex justify-between">
              <span>{apiError}</span>
              <button onClick={() => setApiError(null)}>✕</button>
            </div>
          )}

          <form onSubmit={handleSubmit} id="project-form" className="space-y-4">
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
                      placeholder="MMYYYY (e.g., 022023)"
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
                      placeholder="MMYYYY (e.g., 022023)"
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

        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
          <Button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="px-4 py-2 text-white bg-gray-600 border border-gray-600 rounded-md hover:bg-gray-700 transition-colors"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="project-form"
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner className="mr-2" /> : null}
            {isSubmitting ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

CreateProjectModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreateSuccess: PropTypes.func.isRequired
};
