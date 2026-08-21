import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '../components/Spinner';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import {
  getProjects, createProject, updateProject, deleteProject, getPeople
} from '../services/api';

const inputClass =
  'w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [addOpen, setAddOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRefs = useRef({});
  const menuRef = useRef(null);

  const closeMenu = useCallback(() => setOpenMenuId(null), []);

  const toggleMenu = useCallback((projectId) => {
    setOpenMenuId(prev => {
      if (prev === projectId) return null;
      const btn = buttonRefs.current[projectId];
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const menuHeight = 88; // approximate height of 2-item menu
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpward = spaceBelow < menuHeight + 8;
        setMenuPos({
          top: openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4,
          left: rect.right - 144 // 144px = w-36
        });
      }
      return projectId;
    });
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId, closeMenu]);

  const load = () => {
    Promise.all([getProjects(), getPeople()])
      .then(([projRes, peopleRes]) => {
        setProjects(projRes.data);
        setPeople(peopleRes.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || err.message);
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  // Leads + solo members (members with no manager) can own projects
  const eligibleOwners = people.filter(p =>
    p.role === 'lead' || (p.role === 'member' && !p.managerId)
  );

  const handleDelete = async (project) => {
    if (!window.confirm(`Delete project "${project.name}"? Tasks referencing it must be removed first.`)) return;
    try {
      await deleteProject(project.id);
      setProjects(prev => prev.filter(p => p.id !== project.id));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create projects and manage project ownership.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ Add Project</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Project</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Description</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Owner</th>
                <th className="text-center p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Status</th>
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr key={project.id} className="border-b border-gray-100">
                  <td className="p-2.5 font-semibold text-gray-900">{project.name}</td>
                  <td className="p-2.5 text-gray-600 max-w-[250px] truncate">{project.description || '—'}</td>
                  <td className="p-2.5 text-gray-700">{project.ownerName || '—'}</td>
                  <td className="p-2.5 text-center">
                    <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Active</span>
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      ref={(el) => { buttonRefs.current[project.id] = el; }}
                      onClick={() => toggleMenu(project.id)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
                      aria-label="Project actions"
                      title="Project actions"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No projects yet. Click "+ Add Project" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AddProjectModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(project) => {
          setProjects(prev => [...prev, project]);
          setAddOpen(false);
        }}
        eligibleOwners={eligibleOwners}
      />

      {editProject && (
        <EditProjectModal
          isOpen={!!editProject}
          onClose={() => setEditProject(null)}
          project={editProject}
          onUpdated={(updated) => {
            setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
            setEditProject(null);
          }}
          eligibleOwners={eligibleOwners}
        />
      )}

      {openMenuId && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
        >
          {(() => {
            const project = projects.find(p => p.id === openMenuId);
            if (!project) return null;
            return (
              <>
                <button
                  onClick={() => { setEditProject(project); closeMenu(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition text-left"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => { handleDelete(project); closeMenu(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition text-left"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              </>
            );
          })()}
        </div>,
        document.body
      )}
    </div>
  );
};

// ---------- Add Project Modal ----------

const AddProjectModal = ({ isOpen, onClose, onCreated, eligibleOwners }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setOwnerId('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        ownerId: ownerId || null
      };
      const res = await createProject(payload);
      reset();
      onCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} ariaLabel="Add project">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Add Project</h2>
        <p className="text-sm text-gray-500">Create a project and assign ownership in one step.</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              className={inputClass}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className={inputClass}
            >
              <option value="">No owner — Unassigned</option>
              {eligibleOwners.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.role === 'lead' ? 'Lead' : 'Member'} — {p.team}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Leads and solo members can own projects.</p>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Project'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

// ---------- Edit Project Modal ----------

const EditProjectModal = ({ isOpen, onClose, project, onUpdated, eligibleOwners }) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [ownerId, setOwnerId] = useState(project.ownerId || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        ownerId: ownerId || null
      };
      const res = await updateProject(project.id, payload);
      onUpdated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Edit project">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Edit Project</h2>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className={inputClass}
            >
              <option value="">No owner — Unassigned</option>
              {eligibleOwners.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.role === 'lead' ? 'Lead' : 'Member'} — {p.team}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Leads and solo members can own projects.</p>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default Projects;
