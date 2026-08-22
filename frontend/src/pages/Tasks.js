import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { Modal } from '../components/Modal';
import TaskFormModal from '../components/TaskFormModal';
import {
  getTasks, getPeople, getProjects, updateTask, deleteTask as deleteTaskApi
} from '../services/api';
import { todayMonday, toISO, formatWeekLabel, weekToMonday } from '../utils/dateUtils';

const inputClass =
  'w-full h-11 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition';

const TASK_STATUS = {
  todo: { label: 'Todo', bg: 'bg-gray-100', text: 'text-gray-700' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-50', text: 'text-blue-700' },
  completed: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700' }
};

const TASKS_PER_PAGE = 10;

// Lead management scope: self + everyone below in the manager tree
const visibleIdsForLead = (personId, people) => {
  const visible = new Set([personId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of people) {
      if (p.managerId && visible.has(p.managerId) && !visible.has(p.id)) {
        visible.add(p.id);
        changed = true;
      }
    }
  }
  return visible;
};

const TasksPage = ({ user }) => {
  const isBoss = user.role === 'boss';
  const isLead = user.role === 'lead';
  const canCreate = isBoss || isLead;
  const canManage = isBoss || isLead;

  const [tasks, setTasks] = useState([]);
  const [people, setPeople] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const load = () => {
    Promise.all([getTasks(), getPeople(), getProjects()])
      .then(([tasksRes, peopleRes, projectsRes]) => {
        setTasks(tasksRes.data);
        setPeople(peopleRes.data);
        setProjects(projectsRes.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || err.message);
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  const myVisibleIds = useMemo(() => (
    isLead ? visibleIdsForLead(user.personId, people) : null
  ), [isLead, user.personId, people]);

  // Which rows can this user manage (edit/delete/reassign)?
  const rowInScope = (task) => {
    if (isBoss) return true;
    if (!isLead) return false;
    if (task.parentId) return false; // chunk ownership checked server-side; UI keeps chunks manage-only via parent owner
    if (task.assigneeId && myVisibleIds && myVisibleIds.has(task.assigneeId)) return true;
    if (!task.assigneeId && task.createdBy === user.personId) return true;
    return false;
  };
  const canEditRow = (task) => canManage && rowInScope(task);

  // Who can change a task's status?
  const canChangeStatus = (task) => {
    if (isBoss) return true;
    if (isEngineerCheck()) return task.assigneeId === user.personId;
    if (isLead) {
      if (!task.parentId) return rowInScope(task);
      return false; // chunk statuses managed by owning lead only
    }
    return false;
  };
  function isEngineerCheck() { return user.role === 'engineer'; }

  const delegatedParentIds = useMemo(
    () => new Set(tasks.filter(t => t.parentId).map(t => t.parentId)),
    [tasks]
  );

  const projectNameById = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, p.name])),
    [projects]
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const titleMatch = t.title.toLowerCase().includes(q);
        const assigneeMatch = (t.assigneeName || '').toLowerCase().includes(q);
        if (!titleMatch && !assigneeMatch) return false;
      }
      if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
      if (statusFilter !== 'all' && (t.status || 'todo') !== statusFilter) return false;
      return true;
    }).sort((a, b) => {
      const pa = projectNameById[a.projectId] || '';
      const pb = projectNameById[b.projectId] || '';
      if (pa !== pb) return pa.localeCompare(pb);
      if (a.week !== b.week) return (a.week || '').localeCompare(b.week || '');
      return a.title.localeCompare(b.title);
    });
  }, [tasks, searchQuery, projectFilter, statusFilter, projectNameById]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / TASKS_PER_PAGE));
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * TASKS_PER_PAGE,
    currentPage * TASKS_PER_PAGE
  );

  const hasActiveFilters = searchQuery || projectFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setProjectFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredTasks.length / TASKS_PER_PAGE));
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [filteredTasks.length, currentPage]);

  const handleStatusChange = async (task, status) => {
    const prevStatus = task.status;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
    try {
      await updateTask(task.id, { status });
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: prevStatus } : t));
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTaskApi(deleteTarget.id);
      setDeleteTarget(null);
      load();
      const maxPage = Math.max(1, Math.ceil((filteredTasks.length - 1) / TASKS_PER_PAGE));
      if (currentPage > maxPage) setCurrentPage(maxPage);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setDeleteTarget(null);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  let lastProjectName = null;

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
          <h1 className="text-2xl font-semibold text-gray-800">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {canCreate ? 'Create and manage tasks across projects.' : 'Your assigned tasks. Update their status as you progress.'}
          </p>
        </div>
        {canCreate && <Button onClick={() => setAddOpen(true)}>+ Add Task</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          placeholder="Search tasks or assignees..."
          className="flex-1 min-w-[200px] h-10 px-3.5 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
        />
        <select
          value={projectFilter}
          onChange={(e) => { setProjectFilter(e.target.value); setCurrentPage(1); }}
          className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
        >
          <option value="all">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
        >
          <option value="all">All statuses</option>
          {Object.entries(TASK_STATUS).map(([value, cfg]) => (
            <option key={value} value={value}>{cfg.label}</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="h-10 px-3 text-sm text-gray-500 hover:text-gray-700 underline transition">
            Clear filters
          </button>
        )}
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{'Tasks (' + filteredTasks.length + ')'}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Task</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Assignee</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Created By</th>
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Hours</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Week</th>
                <th className="text-center p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Status</th>
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTasks.map(task => {
                const showGroupHeader = (projectNameById[task.projectId] || 'Unknown') !== lastProjectName;
                lastProjectName = projectNameById[task.projectId] || 'Unknown';
                const st = TASK_STATUS[task.status || 'todo'] || TASK_STATUS.todo;
                const editable = canChangeStatus(task);
                const manageable = canEditRow(task);
                const isDelegatedParent = delegatedParentIds.has(task.id);
                return (
                  <React.Fragment key={task.id}>
                    {showGroupHeader && (
                      <tr>
                        <td colSpan={7} className="p-2.5 bg-gray-50 border-y border-gray-200">
                          <span className="font-semibold text-gray-800">{projectNameById[task.projectId] || 'Unknown project'}</span>
                        </td>
                      </tr>
                    )}
                    <tr className={'border-b border-gray-100 hover:bg-gray-50/50 transition'}>
                      <td className="p-2.5">
                        <div className={task.parentId ? '' : 'font-medium text-gray-900'}>
                          {task.title}
                        </div>
                        {task.parentId && (
                          <div className="text-xs text-gray-400 italic mt-0.5">chunk of {task.parentTitle || 'parent task'}</div>
                        )}
                        {isDelegatedParent && (
                          <div className="mt-0.5"><span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">delegated</span></div>
                        )}
                      </td>
                      <td className="p-2.5 text-gray-700">{task.assigneeName || <span className="text-gray-400">Unassigned</span>}</td>
                      <td className="p-2.5 text-gray-500">{task.createdByName || <span className="text-gray-300">&#8212;</span>}</td>
                      <td className="p-2.5 text-right">
                        {isDelegatedParent
                          ? <span className="text-gray-400">&#8212;</span>
                          : <span className="font-medium text-gray-800">{task.estimatedHours}h</span>}
                      </td>
                      <td className="p-2.5 text-gray-600">{formatWeekLabel(task.week)}</td>
                      <td className="p-2.5 text-center">
                        {editable ? (
                          <select
                            value={task.status || 'todo'}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            title="Update status"
                            className={'cursor-pointer text-xs font-medium px-2 py-1 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-blue-300 transition ' + st.bg + ' ' + st.text}
                          >
                            {Object.entries(TASK_STATUS).map(([value, cfg]) => (
                              <option key={value} value={value}>{cfg.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={'inline-block text-xs font-medium px-2 py-0.5 rounded-full ' + st.bg + ' ' + st.text}>{st.label}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap">
                        {manageable ? (
                          <>
                            <button
                              onClick={() => setEditTask(task)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition mr-1"
                              aria-label="Edit task"
                              title="Edit task"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(task)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
                              aria-label="Delete task"
                              title="Delete task"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <span className="text-gray-300">&#8212;</span>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {tasks.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">
                  {canCreate ? 'No tasks yet. Click "+ Add Task" to create one.' : 'No tasks assigned to you yet.'}
                </td></tr>
              )}
              {tasks.length > 0 && filteredTasks.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">
                  <p className="font-medium text-gray-500">No tasks found</p>
                  <p className="text-sm mt-1">Try changing your search or filters.</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredTasks.length > TASKS_PER_PAGE && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              {'Showing ' + ((currentPage - 1) * TASKS_PER_PAGE + 1) + '\u2013' + Math.min(currentPage * TASKS_PER_PAGE, filteredTasks.length) + ' of ' + filteredTasks.length}
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

      <TaskFormModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); load(); setCurrentPage(1); }}
        people={people}
        projects={projects}
        currentMonday={toISO(todayMonday())}
        isBoss={isBoss}
      />

      {editTask && (
        <EditTaskModal
          isOpen={!!editTask}
          onClose={() => setEditTask(null)}
          task={editTask}
          user={user}
          people={people}
          projects={projects}
          onSaved={(updated) => {
            setEditTask(null);
            setTasks(prev => prev.map(t => {
              if (t.id !== updated.id) return t;
              const person = people.find(p => p.id === updated.assigneeId);
              const project = projects.find(p => p.id === updated.projectId);
              return {
                ...t,
                ...updated,
                assigneeName: person ? person.name : null,
                projectName: project ? project.name : null,
                createdByName: updated.createdByName ?? t.createdByName
              };
            }));
          }}
        />
      )}

      {deleteTarget && (
        <DeleteTaskModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          task={deleteTarget}
          onDeleted={handleDelete}
        />
      )}
    </div>
  );
};

// ---------- Edit Task Modal ----------

const EditTaskModal = ({ isOpen, onClose, task, user, people, projects, onSaved }) => {
  const isMounted = React.useRef(true);
  React.useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const [title, setTitle] = useState(task.title);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || '');
  const [projectId, setProjectId] = useState(task.projectId || '');
  const [estimatedHours, setEstimatedHours] = useState(task.estimatedHours);
  const [week, setWeek] = useState(task.week);
  const [status, setStatus] = useState(task.status || 'todo');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isChunk = !!task.parentId;
  const isBoss = user.role === 'boss';
  const isLead = user.role === 'lead';

  // Assignee options follow the same rules the backend enforces
  const assigneeChoices = useMemo(() => {
    if (isChunk) {
      // Only the owning lead may reassign chunks (self or direct reports)
      return isLead ? people.filter(p => p.id === user.personId || p.managerId === user.personId) : [];
    }
    // Top-level: GET /people already returns the scoped list for leads; boss sees everyone
    // and the server-side delegation rule (leads/solo only) still applies.
    return people;
  }, [isLead, isChunk, people, user.personId]);

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
      const payload = {
        title: title.trim(),
        assigneeId: assigneeId || null,
        estimatedHours: Number(estimatedHours),
        week: toISO(monday),
        status
      };
      if (!isChunk) payload.projectId = projectId;
      const res = await updateTask(task.id, payload);
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Edit task">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Edit Task</h2>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Assignee</label>
            {assigneeChoices.length === 0 ? (
              <input
                type="text"
                value={task.assigneeName || 'Unassigned'}
                disabled
                className="w-full h-11 px-3.5 rounded-md border border-gray-300 bg-gray-100 text-sm text-gray-600"
              />
            ) : (
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className={inputClass}
              >
                {!isChunk && <option value="">Unassigned</option>}
                {assigneeChoices.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} &#8212; {p.role === 'lead' ? 'Lead' : 'Member'} &#183; {p.team}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={inputClass}
              disabled={isChunk}
              required={!isChunk}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {isChunk && <p className="text-xs text-gray-400 mt-1">Chunks inherit the project of their parent task.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated hours</label>
              <input type="number" min="1" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Week (any day)</label>
              <input type="date" value={week} onChange={(e) => setWeek(e.target.value)} className={inputClass} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              {Object.entries(TASK_STATUS).map(([value, cfg]) => (
                <option key={value} value={value}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

// ---------- Delete Task Modal ----------

const DeleteTaskModal = ({ isOpen, onClose, task, onDeleted }) => {
  const isMounted = React.useRef(true);
  React.useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDeleted();
    } finally {
      if (isMounted.current) setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Delete task">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Delete Task</h2>
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <span className="font-semibold">{task.title}</span>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={deleting} onClick={handleDelete}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TasksPage;
