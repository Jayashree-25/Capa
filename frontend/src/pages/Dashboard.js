import React, { useEffect, useState } from 'react';
import { getProjects, getCapacity } from '../services/api';
import { Card } from '../components/Card';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [capacity, setCapacity] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">📊 Capacity Planning Dashboard</h1>

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
    </div>
  );
};

export default Dashboard;
