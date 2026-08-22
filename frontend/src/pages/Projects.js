import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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

const textareaClass =
  'w-full px-3.5 py-2.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition resize-none';

const STATUS_CONFIG = {
  active:    { label: 'Active',    bg: 'bg-green-100',  text: 'text-green-800' },
  on_hold:   { label: 'On Hold',   bg: 'bg-amber-100',  text: 'text-amber-800' },
  completed: { label: 'Completed', bg: 'bg-blue-100',   text: 'text-blue-800' },
};

const PROJECTS_PER_PAGE = 10;

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRefs = useRef({});
  const menuRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterOwner, setFilterOwner] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const closeMenu = useCallback(() => setOpenMenuId(null), []);

  const toggleMenu = useCallback((projectId) => {
    setOpenMenuId(prev => {
      if (prev === projectId) return null;
      const btn = buttonRefs.current[projectId];
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const menuHeight = 88;
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpward = spaceBelow < menuHeight + 8;
        setMenuPos({
          top: openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4,
          left: rect.right - 144
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

  const eligibleOwners = useMemo(() => people.filter(p =>
    p.role === 'lead' || (p.role === 'member' && !p.managerId)
  ), [people]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        if (!nameMatch && !descMatch) return false;
      }
      if (filterOwner !== 'all' && p.ownerId !== filterOwner) return false;
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      return true;
    });
  }, [projects, searchQuery, filterOwner, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE));
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * PROJECTS_PER_PAGE,
    currentPage * PROJECTS_PER_PAGE
  );

  const hasActiveFilters = searchQuery || filterOwner !== 'all' || filterStatus !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterOwner('all');
    setFilterStatus('all');
    setCurrentPage(1);
  };

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [filteredProjects.length, currentPage]);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create projects and manage project ownership.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ Add Project</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          placeholder="Search projects..."
          className="flex-1 min-w-[200px] h-10 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
        />
        <select
          value={filterOwner}
          onChange={(e) => { setFilterOwner(e.target.value); setCurrentPage(1); }}
          className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
        >
          <option value="all">All owners</option>
          {eligibleOwners.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="h-10 px-3 text-sm text-gray-500 hover:text-gray-700 underline transition"
          >
            Clear filters
          </button>
        )}
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{'Projects (' + filteredProjects.length + ')'}</h2>
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
              {paginatedProjects.map(project => {
                const s = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;
                return (
                  <tr key={project.id} className="border-b border-gray-100">
                    <td className="p-2.5 font-semibold text-gray-900">{project.name}</td>
                    <td className="p-2.5 max-w-[250px]">
                      <button
                        onClick={() => setSelectedProject(project)}
                        className="text-left text-gray-600 truncate block max-w-full hover:text-blue-600 transition"
                      >
                        {project.description || '\u2014'}
                      </button>
                    </td>
                    <td className="p-2.5 text-gray-700">{project.ownerName || '\u2014'}</td>
                    <td className="p-2.5 text-center">
                      <span className={'inline-block text-xs px-2 py-0.5 rounded-full ' + s.bg + ' ' + s.text}>{s.label}</span>
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
                );
              })}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No projects yet. Click "+ Add Project" to create one.
                  </td>
                </tr>
              )}
              {projects.length > 0 && filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    <p className="font-medium text-gray-500">No projects found</p>
                    <p className="text-sm mt-1">Try changing your search or filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredProjects.length > PROJECTS_PER_PAGE && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              {'Showing ' + ((currentPage - 1) * PROJECTS_PER_PAGE + 1) + '\u2013' + Math.min(currentPage * PROJECTS_PER_PAGE, filteredProjects.length) + ' of ' + filteredProjects.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {'\u2190'} Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={'w-9 h-9 text-sm rounded-md transition ' + (page === currentPage
                    ? 'bg-blue-600 text-white font-medium'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50')}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next {'\u2192'}
              </button>
            </div>
          </div>
        )}
      </Card>

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
                  onClick={() => { setDeleteProjectTarget(project); closeMenu(); }}
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

      <AddProjectModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(project) => {
          setProjects(prev => [...prev, project]);
          setAddOpen(false);
          setCurrentPage(1);
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

      {deleteProjectTarget && (
        <DeleteProjectModal
          isOpen={!!deleteProjectTarget}
          onClose={() => setDeleteProjectTarget(null)}
          project={deleteProjectTarget}
          onDeleted={() => {
            setProjects(prev => prev.filter(p => p.id !== deleteProjectTarget.id));
            setDeleteProjectTarget(null);
            const maxPage = Math.max(1, Math.ceil((filteredProjects.length - 1) / PROJECTS_PER_PAGE));
            if (currentPage > maxPage) {
              setCurrentPage(maxPage);
            }
          }}
        />
      )}

      {selectedProject && (
        <ProjectDetailModal
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          project={selectedProject}
        />
      )}
    </div>
  );
};

// ---------- Add Project Modal ----------

const AddProjectModal = ({ isOpen, onClose, onCreated, eligibleOwners }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setOwnerId('');
    setStatus('active');
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
        ownerId: ownerId || null,
        status
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
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the project scope, goals, and key details..."
              rows={4}
              className={textareaClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className={inputClass}
            >
              <option value="">No owner \u2014 Unassigned</option>
              {eligibleOwners.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} \u2014 {p.role === 'lead' ? 'Lead' : 'Member'} \u2014 {p.team}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Leads and solo members can own projects.</p>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating\u2026' : 'Create Project'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

// ---------- Edit Project Modal ----------

const EditProjectModal = ({ isOpen, onClose, project, onUpdated, eligibleOwners }) => {
  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [ownerId, setOwnerId] = useState(project.ownerId || '');
  const [status, setStatus] = useState(project.status || 'active');
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
        ownerId: ownerId || null,
        status
      };
      const res = await updateProject(project.id, payload);
      onUpdated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setSubmitting(false);
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
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the project scope, goals, and key details..."
              rows={4}
              className={textareaClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className={inputClass}
            >
              <option value="">No owner \u2014 Unassigned</option>
              {eligibleOwners.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} \u2014 {p.role === 'lead' ? 'Lead' : 'Member'} \u2014 {p.team}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Leads and solo members can own projects.</p>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving\u2026' : 'Save Changes'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

// ---------- Delete Project Modal ----------

const DeleteProjectModal = ({ isOpen, onClose, project, onDeleted }) => {
  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setSubmitting(true);
    setError('');
    try {
      await deleteProject(project.id);
      onDeleted();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Delete project">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Delete Project</h2>
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <span className="font-semibold">{project.name}</span>?
          This action cannot be undone.
        </p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}
        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={submitting} onClick={handleDelete}>
            {submitting ? 'Deleting\u2026' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ---------- Project Detail Modal ----------

const ProjectDetailModal = ({ isOpen, onClose, project }) => {
  const s = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Project details">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-800">{project.name}</h2>
          <span className={'inline-block text-xs px-2 py-0.5 rounded-full shrink-0 ' + s.bg + ' ' + s.text}>{s.label}</span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Description</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.description || '\u2014'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Owner</p>
          <p className="text-sm text-gray-700">{project.ownerName || 'Unassigned'}</p>
        </div>
        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
};

export default Projects;
