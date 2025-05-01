import React, { useEffect, useState } from 'react';
import { getProjects, getTeams } from '../services/api';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = parseInt(dateStr.substring(0, 2)) - 1;
  const year = dateStr.substring(2);
  return `${months[month]} ${year}`;
};

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsRes, teamsRes] = await Promise.all([
          getProjects().catch(e => ({ data: [] })),
          getTeams().catch(e => ({ data: [] }))
        ]);
        setProjects(projectsRes.data);
        setTeams(teamsRes.data);
      } catch (err) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (error) return <div className="p-4 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Capacity Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Projects Card */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">Projects ({projects.length})</h2>
          {projects.length > 0 ? (
            <div className="space-y-4">
              {projects.map((project) => (
                <div 
                  key={project.id} 
                  className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm hover:shadow-md transition-shadow duration-300"
                >
                  <h3 className="font-bold text-xl text-gray-800">{project.name}</h3>
                  <div className="mt-3 text-sm text-gray-600 space-y-2">
                    <p>Team: {project.team || 'Unassigned'}</p>
                    {project.effort && <p>Effort: {project.effort} hrs</p>}
                    {project.priority && (
                      <p>Priority: <span className="capitalize font-medium">{project.priority.toLowerCase()}</span></p>
                    )}
                    {project.startDate && project.endDate && (
                      <div className="mt-2">
                        <p className="font-medium">Timeline:</p>
                        <p>Start: {formatDate(project.startDate)}</p>
                        <p>End: {formatDate(project.endDate)}</p>
                      </div>
                    )}
                    {project.phases && (
                      <div className="mt-3">
                        <p className="font-medium">Phases:</p>
                        <div className="space-y-2">
                          {Object.entries(project.phases).map(([phaseName, phaseDetails]) => (
                            <div key={phaseName} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="capitalize font-medium">{phaseName}</span>
                                <span>{formatDate(phaseDetails.start)} - {formatDate(phaseDetails.end)}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full" 
                                  style={{ width: `${phaseDetails.progress || 0}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-500">Team members: {phaseDetails.teamMembers}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">No projects found</p>
          )}
        </div>

        {/* Teams Card */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">Teams ({teams.length})</h2>
          {teams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map((team) => (
                <div 
                  key={team.name} 
                  className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow duration-300"
                >
                  <h3 className="font-bold text-lg text-gray-800">{team.name}</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Members: <span className="font-medium">{team.memberCount || 0}</span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">No teams found</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
