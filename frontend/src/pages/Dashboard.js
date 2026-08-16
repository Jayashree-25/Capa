import React, { useEffect, useState, useCallback, Fragment } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Spinner } from '../components/Spinner';
import PersonFormModal from '../components/PersonFormModal';
import ProjectFormModal from '../components/ProjectFormModal';
import TaskFormModal from '../components/TaskFormModal';
import ChunkFormModal from '../components/ChunkFormModal';
import {
  getPeople, getProjects, getTasks, getTeamNames, getLoadReport,
  updateTask, deleteTask, deletePerson
} from '../services/api';
import {
  todayMonday, firstOfMonth, addWeeks, addMonths, buildBuckets,
  formatWeekLabel, formatMonthLabel, toISO
} from '../utils/dateUtils';
import { buildHierarchyRows } from '../utils/hierarchy';

const WEEK_COUNT = 6;
const MONTH_COUNT = 3;

const cellStyle = (bucket) => {
  if (bucket.overloaded) return 'bg-red-50 text-red-700 border-red-200';
  if (bucket.utilization >= 0.8) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-green-50 text-green-700 border-green-200';
};

const TASK_DRAG_TYPE = 'application/x-capa-task';

const getDraggedTaskId = (dataTransfer) => {
  const custom = dataTransfer.getData(TASK_DRAG_TYPE);
  if (custom) return custom;
  const plain = dataTransfer.getData('text/plain');
  return plain && plain.startsWith('t-') ? plain : null;
};

const Dashboard = ({ user }) => {
  const isBoss = user.role === 'boss';
  const canManage = user.role === 'boss' || user.role === 'lead';
  const [people, setPeople] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamNames, setTeamNames] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [granularity, setGranularity] = useState('week');
  const [periodStart, setPeriodStart] = useState(() => todayMonday());
  const [teamFilter, setTeamFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [chunkModalOpen, setChunkModalOpen] = useState(false);
  const [chunkParent, setChunkParent] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [collapsedLeads, setCollapsedLeads] = useState(() => new Set());

  const buckets = buildBuckets(granularity, periodStart, granularity === 'week' ? WEEK_COUNT : MONTH_COUNT);

  const refreshReport = useCallback(() => {
    getLoadReport({
      granularity,
      from: buckets[0],
      to: buckets[buckets.length - 1],
      team: teamFilter || undefined,
      project: projectFilter || undefined
    })
      .then(res => setReport(res.data))
      .catch(err => setError(err.response?.data?.error || err.message));
  }, [granularity, teamFilter, projectFilter, buckets.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([
      getPeople(), getProjects(), getTasks(), getTeamNames()
    ])
      .then(([peopleRes, projectsRes, tasksRes, teamsRes]) => {
        setPeople(peopleRes.data);
        setProjects(projectsRes.data);
        setTasks(tasksRes.data);
        setTeamNames(teamsRes.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refreshReport();
  }, [refreshReport]);

  const handleReassign = async (taskId, assigneeId) => {
    const existing = tasks.find(t => t.id === taskId);
    if (!existing) return;
    try {
      await updateTask(taskId, { assigneeId });
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        const person = people.find(p => p.id === assigneeId);
        return { ...t, assigneeId, assigneeName: person ? person.name : null };
      }));
      refreshReport();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await deleteTask(task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));
      refreshReport();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDeletePerson = async (person) => {
    if (!window.confirm(`Delete person "${person.name}"? Tasks must be reassigned first.`)) return;
    try {
      await deletePerson(person.id);
      setPeople(prev => prev.filter(p => p.id !== person.id));
      setTeamNames((await getTeamNames()).data);
      refreshReport();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleCreatedPerson = async (person) => {
    setPeople(prev => [...prev, person]);
    setTeamNames((await getTeamNames()).data);
    refreshReport();
  };

  const handleCreatedProject = (project) => setProjects(prev => [...prev, project]);

  const handleCreatedTask = () => {
    getTasks().then(res => setTasks(res.data));
    refreshReport();
  };

  const openChunkModal = (task) => {
    setChunkParent(task);
    setChunkModalOpen(true);
  };

  const chunkAssignees = user.role === 'lead'
    ? people.filter(p => p.id === user.personId || p.managerId === user.personId)
    : [];

  const navigate = (dir) => {
    setPeriodStart(prev => granularity === 'week' ? addWeeks(prev, dir * WEEK_COUNT) : addMonths(prev, dir * MONTH_COUNT));
  };

  const toggleLead = (leadId) => {
    setCollapsedLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const rangeLabel = granularity === 'week'
    ? `${formatWeekLabel(buckets[0])} – ${formatWeekLabel(buckets[buckets.length - 1])}, ${buckets[0].slice(0, 4)}`
    : `${formatMonthLabel(buckets[0])} – ${formatMonthLabel(buckets[buckets.length - 1])}`;

  const taskGroups = () => {
    const groups = new Map();
    groups.set('unassigned', []);
    for (const p of report ? report.people : []) groups.set(p.id, []);
    for (const t of tasks) {
      const key = t.assigneeId && groups.has(t.assigneeId) ? t.assigneeId : 'unassigned';
      groups.get(key).push(t);
    }
    return groups;
  };

  const overloadedCount = report ? report.people.filter(p => p.overloaded).length : 0;
  const totalAssigned = report ? report.people.reduce((s, p) => s + p.totalAssignedHours, 0) : 0;
  const totalCapacity = report ? report.people.reduce((s, p) => s + p.totalCapacityHours, 0) : 0;

  if (loading) return <div className="p-4 text-center flex justify-center"><Spinner /></div>;

  const delegatedParentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId));

  const groups = taskGroups();
  const hierarchyRows = isBoss && report ? buildHierarchyRows(report.people) : [];

  const renderPersonRow = (person, { isLead = false, isMember = false, hasMembers = false, collapsed = false } = {}) => (
    <tr
      key={person.id}
      onDragOver={(e) => { e.preventDefault(); setDropTarget(person.id); }}
      onDragLeave={() => setDropTarget(prev => prev === person.id ? null : prev)}
      onDrop={(e) => {
        e.preventDefault();
        setDropTarget(null);
        const taskId = getDraggedTaskId(e.dataTransfer);
        if (taskId) handleReassign(taskId, person.id);
      }}
      className={`border-b border-gray-100 ${person.overloaded ? 'bg-red-50' : ''} ${dropTarget === person.id ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
    >
      <td className={`p-2.5 ${isMember ? 'pl-10' : ''}`}>
        <div className="flex items-center gap-2">
          {isLead && hasMembers && (
            <button
              onClick={() => toggleLead(person.id)}
              className="w-4 text-gray-400 hover:text-gray-600 text-xs leading-none text-center"
              title={collapsed ? 'Expand members' : 'Collapse members'}
            >
              {collapsed ? '▸' : '▾'}
            </button>
          )}
          <span className={isMember ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}>{person.name}</span>
          {isLead && <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Lead</span>}
          {person.overloaded && <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Overloaded</span>}
          {canManage && (
            <button
              onClick={() => handleDeletePerson(person)}
              className="text-gray-300 hover:text-red-500"
              title="Delete person"
            >✕</button>
          )}
        </div>
      </td>
      <td className="p-2.5 text-gray-600">{person.team}</td>
      <td className="p-2.5 text-right">{person.weeklyCapacity}h</td>
      {person.buckets.map(bucket => (
        <td key={bucket.key} className={`p-2 text-center border rounded m-0 ${cellStyle(bucket)}`}>
          <span className="font-semibold">{bucket.assignedHours}h</span>
          {granularity === 'week' && (
            <span className="block text-[11px] opacity-70">of {bucket.capacityHours}h</span>
          )}
        </td>
      ))}
      <td className={`p-2.5 text-right font-semibold ${person.totalAssignedHours > person.totalCapacityHours ? 'text-red-600' : ''}`}>
        {person.totalAssignedHours}h
      </td>
      <td className="p-2.5 text-center">
        {person.overloaded
          ? <span className="inline-block bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">Overloaded</span>
          : <span className="inline-block bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">OK</span>}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 text-red-800 p-3 rounded flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitor team capacity and workload across upcoming weeks.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setTaskModalOpen(true)}>+ Add Task</Button>
          {canManage && <Button variant="secondary" onClick={() => setPersonModalOpen(true)}>+ Add Person</Button>}
          {canManage && <Button variant="secondary" onClick={() => setProjectModalOpen(true)}>+ Add Project</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><div className="text-sm text-gray-500">People in view</div><div className="text-3xl font-semibold tracking-tight text-gray-900">{report ? report.people.length : 0}</div></Card>
        <Card>
          <div className="text-sm text-gray-500">Overloaded</div>
          <div className={`text-3xl font-semibold tracking-tight ${overloadedCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {overloadedCount}
          </div>
        </Card>
        <Card><div className="text-sm text-gray-500">Assigned in range</div><div className="text-3xl font-semibold tracking-tight text-gray-900">{totalAssigned}h</div></Card>
        <Card><div className="text-sm text-gray-500">Available in range</div><div className="text-3xl font-semibold tracking-tight text-gray-900">{Math.max(0, totalCapacity - totalAssigned)}h</div></Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {['week', 'month'].map(mode => (
              <button
                key={mode}
                onClick={() => {
                  setGranularity(mode);
                  setPeriodStart(mode === 'week' ? todayMonday() : firstOfMonth(new Date()));
                }}
                className={`h-10 px-4 text-sm font-medium capitalize ${granularity === mode ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="h-10 w-9 border border-gray-300 rounded-md hover:bg-gray-100 text-gray-600 text-lg leading-none">‹</button>
            <span className="font-semibold text-gray-800 text-sm min-w-[180px] text-center">{rangeLabel}</span>
            <button onClick={() => navigate(1)} className="h-10 w-9 border border-gray-300 rounded-md hover:bg-gray-100 text-gray-600 text-lg leading-none">›</button>
          </div>

          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All teams</option>
            {teamNames.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Person</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Team</th>
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Cap/wk</th>
                {buckets.map(key => (
                  <th key={key} className="text-center p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">
                    {granularity === 'week' ? formatWeekLabel(key) : formatMonthLabel(key)}
                  </th>
                ))}
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Total</th>
                <th className="text-center p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isBoss && report
                ? hierarchyRows.map(row => {
                    if (row.kind === 'lead') {
                      const collapsed = collapsedLeads.has(row.person.id);
                      return (
                        <Fragment key={row.person.id}>
                          {renderPersonRow(row.person, { isLead: true, hasMembers: row.members.length > 0, collapsed })}
                          {!collapsed && row.members.map(member => renderPersonRow(member, { isMember: true }))}
                        </Fragment>
                      );
                    }
                    return renderPersonRow(row.person);
                  })
                : report && report.people.map(person => renderPersonRow(person))}
              {report && (
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-200">
                  <td className="p-2.5" colSpan="3">Team total</td>
                  {report.teamTotals.map(bucket => (
                    <td key={bucket.key} className={`p-2 text-center ${bucket.overloaded ? 'text-red-600' : ''}`}>
                      {bucket.assignedHours}/{bucket.capacityHours}h
                    </td>
                  ))}
                  <td className="p-2.5 text-right">{totalAssigned}h</td>
                  <td className="p-2.5 text-center">
                    {report.teamTotals.some(b => b.overloaded)
                      ? <span className="inline-block bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">Overloaded</span>
                      : <span className="inline-block bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">OK</span>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {canManage
            ? 'Drag a task chip below onto a person\'s row to reassign it.'
            : 'You have read-only access — your manager can reassign tasks.'}
        </p>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Tasks</h2>
        <div className="space-y-4">
          {[...groups.keys()].map(key => {
            const groupTasks = groups.get(key);
            if (groupTasks.length === 0) return null;
            const person = key === 'unassigned' ? null : (report ? report.people.find(p => p.id === key) : null);
            return (
              <div
                key={key}
                onDragOver={(e) => { e.preventDefault(); setDropTarget(key === 'unassigned' ? 'unassigned' : key); }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = getDraggedTaskId(e.dataTransfer);
                  setDropTarget(null);
                  if (taskId) handleReassign(taskId, key === 'unassigned' ? null : key);
                }}
                className={`rounded-lg p-3.5 ${dropTarget === key ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-50/70'}`}
              >
                <h3 className="font-semibold text-gray-800 mb-2">
                  {person ? person.name : 'Unassigned'}
                  <span className="ml-2 text-xs font-normal text-gray-400">{groupTasks.length} task(s)</span>
                  {person && <span className="ml-2 text-xs font-normal text-gray-500">{person.team}</span>}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {groupTasks.map(task => {
                    const isChunk = !!task.parentId;
                    const isDelegatedParent = !isChunk && delegatedParentIds.has(task.id);
                    return (
                      <span
                        key={task.id}
                        draggable={canManage}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
                          e.dataTransfer.setData('text/plain', task.id);
                        }}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm cursor-grab hover:border-blue-400 ${isChunk ? 'bg-white/60 border border-gray-200 text-gray-600' : 'bg-white border border-gray-300 shadow-sm'}`}
                        title={canManage ? 'Drag to another person to reassign' : 'Read-only view'}
                      >
                        <span className="text-gray-400">⋮⋮</span>
                        {isChunk && <span className="text-xs text-gray-400">↳</span>}
                        <span className={isChunk ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}>{task.title}</span>
                        {isChunk
                          ? <span className="text-xs text-gray-400 italic">chunk of {task.parentTitle}</span>
                          : <span className="text-xs text-gray-500">{task.assigneeName || task.projectName}</span>}
                        {isDelegatedParent
                          ? <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full" title="Hours count toward its chunks">delegated</span>
                          : <span className="text-xs text-blue-600 font-semibold">{task.estimatedHours}h</span>}
                        <span className="text-xs text-gray-400">{formatWeekLabel(task.week)}</span>
                        {user.role === 'lead' && !isChunk && task.assigneeId === user.personId && (
                          <button
                            onClick={() => openChunkModal(task)}
                            className="text-gray-400 hover:text-blue-600 ml-1"
                            title="Break into chunks"
                          >+</button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => handleDeleteTask(task)}
                            className="text-gray-300 hover:text-red-500 ml-1"
                            title="Delete task"
                          >✕</button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <TaskFormModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onCreated={handleCreatedTask}
        people={people}
        projects={projects}
        currentMonday={toISO(todayMonday())}
        assigneeLock={canManage ? null : user.personId}
        isBoss={isBoss}
      />
      <ChunkFormModal
        isOpen={chunkModalOpen}
        onClose={() => setChunkModalOpen(false)}
        onCreated={handleCreatedTask}
        parentTask={chunkParent}
        people={chunkAssignees}
        currentMonday={toISO(todayMonday())}
      />
      {canManage && (
        <>
          <PersonFormModal
            isOpen={personModalOpen}
            onClose={() => setPersonModalOpen(false)}
            onCreated={handleCreatedPerson}
            teams={teamNames}
            people={people}
          />
          <ProjectFormModal
            isOpen={projectModalOpen}
            onClose={() => setProjectModalOpen(false)}
            onCreated={handleCreatedProject}
          />
        </>
      )}
    </div>
  );
};

export default Dashboard;