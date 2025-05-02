import React, { useEffect, useState } from 'react';
import { getProjects, getTeams } from '../services/api';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Modal } from '../components/Modal';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { CapacityVisualization } from '../components/CapacityVisualization';
import EditProjectModal from '../components/EditProjectModal';
import { CreateTeamModal } from '../components/CreateTeamModal';
import { EditTeamModal } from '../components/EditTeamModal';
import { CapacityBarChart } from '../components/CapacityBarChart';
import { ProjectCard } from '../components/ProjectCard';

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
  const [projectsError, setProjectsError] = useState(null);
  const [teamsError, setTeamsError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [isEditTeamModalOpen, setIsEditTeamModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsRes, teamsRes] = await Promise.all([
          getProjects().catch(e => { setProjectsError(e.message); return { data: [] }; }),
          getTeams().catch(e => { setTeamsError(e.message); return { data: [] }; })
        ]);
        setProjects(projectsRes.data);
        setTeams(teamsRes.data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const openProjectModal = (project) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleCreateSuccess = (newProject) => {
    setProjects([...projects, newProject]);
    setIsCreateProjectModalOpen(false);
  };

  const handleEditSuccess = (updatedProject) => {
    setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const handleEditTeamSuccess = (updatedTeam) => {
    setTeams(teams.map(t => t.id === updatedTeam.id ? updatedTeam : t));
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (projectsError || teamsError) return <div className="p-4 text-center text-red-500">Error: {projectsError || teamsError}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Capacity Dashboard</h1>
        <div className="dashboard-actions">
          <Button
            onClick={() => setIsCreateProjectModalOpen(true)}
            className="btn-simple btn-create-project"
          >
            Create Project
          </Button>
          <Button
            onClick={() => setIsCreateTeamModalOpen(true)}
            className="btn-simple btn-create-team"
          >
            Create Team
          </Button>
        </div>
      </div>

      <CapacityVisualization />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Projects (Left) */}
        <Card className="p-6 lg:col-span-1">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">Projects ({projects.length})</h2>
          {projects.length > 0 ? (
            <div className="space-y-4">
              {projects.map((project) => (
                <ProjectCard 
                  key={project.id}
                  project={project}
                  onClick={() => openProjectModal(project)}
                  onEdit={() => {
                    setEditingProject(project);
                    setIsEditModalOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">No projects found</p>
          )}
        </Card>

        {/* Teams (Middle) */}
        <Card className="p-6 lg:col-span-1">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">Teams ({teams.length})</h2>
          {teams.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {teams.map((team) => (
                <Card key={team.name} className="p-4 hover:shadow-md transition-shadow duration-300">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg text-gray-800">{team.name}</h3>
                    <button
                      onClick={() => {
                        setEditingTeam(team);
                        setIsEditTeamModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Members: <span className="font-medium">{team.memberCount || 0}</span>
                  </p>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">No teams found</p>
          )}
        </Card>

        {/* Capacity Bar Chart (Right) */}
        <div className="lg:col-span-1">
          <CapacityBarChart />
        </div>
      </div>

      {/* Project Details Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {selectedProject ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">{selectedProject.name}</h2>
            <div className="space-y-2">
              <p><span className="font-medium">Team:</span> {selectedProject.team || 'Unassigned'}</p>
              {selectedProject.effort && <p><span className="font-medium">Effort:</span> {selectedProject.effort} hrs</p>}
              {selectedProject.priority && (
                <p><span className="font-medium">Priority:</span> <span className="capitalize">{selectedProject.priority.toLowerCase()}</span></p>
              )}
              {selectedProject.startDate && selectedProject.endDate && (
                <div>
                  <p className="font-medium">Timeline:</p>
                  <p>Start: {formatDate(selectedProject.startDate)}</p>
                  <p>End: {formatDate(selectedProject.endDate)}</p>
                </div>
              )}
            </div>
            {selectedProject.phases && (
              <div className="mt-4">
                <h3 className="text-xl font-semibold mb-2">Phases</h3>
                <div className="space-y-3">
                  {Object.entries(selectedProject.phases).map(([phaseName, phaseDetails]) => (
                    <div key={phaseName} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium capitalize">{phaseName}</span>
                        <span>{formatDate(phaseDetails.start)} - {formatDate(phaseDetails.end)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${phaseDetails.progress || 0}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-500">Team members: {phaseDetails.teamMembers}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>No project selected</div>
        )}
      </Modal>

      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onCreateSuccess={handleCreateSuccess}
      />

      <EditProjectModal
        project={editingProject}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
      />

      <CreateTeamModal
        isOpen={isCreateTeamModalOpen}
        onClose={() => setIsCreateTeamModalOpen(false)}
        onSuccess={() => {
          // Refresh teams after creating a new team
          // This is a placeholder implementation. You might want to implement a proper refresh logic
          // based on your application's requirements
        }}
      />

      <EditTeamModal
        team={editingTeam}
        isOpen={isEditTeamModalOpen}
        onClose={() => setIsEditTeamModalOpen(false)}
        onSuccess={handleEditTeamSuccess}
      />
    </div>
  );
};

export default Dashboard;
