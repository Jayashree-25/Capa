import React, { useEffect, useState } from 'react';
import { getProjects, getCapacity, addProject, updateCapacity } from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [capacity, setCapacity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [isCapacityModalOpen, setCapacityModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    effort: 0,
    priority: 'Medium',
    team: '',
    month: '',
    available: 0,
    allocated: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      const [projectsData, capacityData] = await Promise.all([
        getProjects(),
        getCapacity(),
      ]);

      setProjects(projectsData.data);
      setCapacity(capacityData.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSubmit = async (e, type) => {
    e.preventDefault();
    try {
      if (type === 'project') {
        await addProject(formData);
      } else {
        await updateCapacity(formData);
      }
      // Refresh data or show success message
      setProjectModalOpen(false);
      setCapacityModalOpen(false);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">📊 Capacity Planning Dashboard</h1>

      <div className="flex gap-4 mb-6">
        <Button onClick={() => setProjectModalOpen(true)}>
          + Add Project
        </Button>
        <Button onClick={() => setCapacityModalOpen(true)}>
          ⚙️ Update Capacity
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold mb-2">🗂 Projects</h2>
          <ul className="space-y-2">
            {projects.map((proj) => (
              <li key={proj.id} className="border rounded p-2 shadow">
                <div className="font-semibold">{proj.name}</div>
                <div className="text-sm text-gray-600">
                  Effort: {proj.effort} hrs | Priority: {proj.priority}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-2">👥 Team Capacity</h2>
          <ul className="space-y-2">
            {capacity.map((cap, idx) => (
              <li key={idx} className="border rounded p-2 shadow">
                <div className="font-semibold">
                  {cap.team} - {cap.month}
                </div>
                <div className="text-sm text-gray-600">
                  Available: {cap.available} | Allocated: {cap.allocated}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Project Modal */}
      <Modal isOpen={isProjectModalOpen} onClose={() => setProjectModalOpen(false)}>
        <h2 className="text-xl font-bold mb-4">Add New Project</h2>
        <form onSubmit={(e) => handleSubmit(e, 'project')}>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Project Name"
              className="w-full p-2 border rounded"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Effort (hours)"
              className="w-full p-2 border rounded"
              value={formData.effort}
              onChange={(e) => setFormData({ ...formData, effort: e.target.value })}
              required
            />
            <select
              className="w-full p-2 border rounded"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
            <Button type="submit">Save Project</Button>
          </div>
        </form>
      </Modal>

      {/* Capacity Modal */}
      <Modal isOpen={isCapacityModalOpen} onClose={() => setCapacityModalOpen(false)}>
        <h2 className="text-xl font-bold mb-4">Update Team Capacity</h2>
        <form onSubmit={(e) => handleSubmit(e, 'capacity')}>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Team Name"
              className="w-full p-2 border rounded"
              value={formData.team}
              onChange={(e) => setFormData({ ...formData, team: e.target.value })}
              required
            />
            <input
              type="month"
              placeholder="Month (YYYY-MM)"
              className="w-full p-2 border rounded"
              value={formData.month}
              onChange={(e) => setFormData({ ...formData, month: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Available Hours"
              className="w-full p-2 border rounded"
              value={formData.available}
              onChange={(e) => setFormData({ ...formData, available: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Allocated Hours"
              className="w-full p-2 border rounded"
              value={formData.allocated}
              onChange={(e) => setFormData({ ...formData, allocated: e.target.value })}
              required
            />
            <Button type="submit">Update Capacity</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Dashboard;
