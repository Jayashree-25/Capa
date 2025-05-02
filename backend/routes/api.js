const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/mockData.json');

// Helper: Load and save JSON data
const loadData = () => JSON.parse(fs.readFileSync(dataPath));
const saveData = (data) => fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

// --- Teams Endpoints (Updated to use mockData.json) ---
/**
 * POST /api/teams
 * Adds a new team to mockData.json.
 */
router.post('/teams', (req, res) => {
  try {
    const data = loadData();
    
    // Initialize teams array if missing
    if (!data.teams) {
      data.teams = [];
    }

    const { name, memberCount } = req.body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Team name is required and must be a non-empty string.' });
    }

    if (typeof memberCount !== 'number' || memberCount <= 0) {
      return res.status(400).json({ error: 'Member count must be a positive number.' });
    }

    // Check for duplicates
    if (data.teams.some(team => team.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'A team with this name already exists.' });
    }

    // Add the team
    const newTeam = { name, memberCount };
    data.teams.push(newTeam);
    saveData(data);

    res.status(201).json({ message: 'Team added successfully.', team: newTeam });
  } catch (error) {
    res.status(500).json({ error: `Failed to add team: ${error.message}` });
  }
});

/**
 * GET /api/teams
 * Lists all teams from mockData.json.
 */
router.get('/teams', (req, res) => {
  try {
    const data = loadData();
    res.json(data.teams || []); // Handle missing teams field
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch teams: ${error.message}` });
  }
});

// --- GET Projects (with calculated fields) ---
router.get('/projects', (req, res) => {
  try {
    const data = loadData();
    if (!data.projects) throw new Error("'projects' field missing in data");

    const formattedProjects = data.projects.map(project => {
      // Calculate total team members and validate phases
      const totalTeamMembers = ['discovery', 'build', 'testing'].reduce(
        (sum, phase) => sum + (project.phases[phase]?.teamMembers || 0), 0
      );

      return {
        id: project.id,
        name: project.name,
        phases: project.phases,
        totalTeamMembers,
        startDate: project.phases.discovery.start, // Project start = discovery start
        endDate: project.phases.testing.end       // Project end = testing end
      };
    });

    res.json(formattedProjects);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch projects: ${error.message}` });
  }
});

// --- POST New Project (with 3 fixed phases) ---
router.post('/projects', (req, res) => {
  try {
    const { name, phases } = req.body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required and must be a non-empty string.' });
    }

    // Validate phases (must include discovery, build, testing)
    const requiredPhases = ['discovery', 'build', 'testing'];
    if (!phases || !requiredPhases.every(phase => phases[phase])) {
      return res.status(400).json({ error: 'All phases (discovery, build, testing) must be provided.' });
    }

    // Validate phase dates (MMYYYY format)
    for (const phase of requiredPhases) {
      const { start, end, teamMembers } = phases[phase];
      if (!/^\d{6}$/.test(start) || !/^\d{6}$/.test(end)) {
        return res.status(400).json({ error: `Phase ${phase} dates must be in MMYYYY format.` });
      }
      if (typeof teamMembers !== 'number' || teamMembers <= 0) {
        return res.status(400).json({ error: `Phase ${phase} teamMembers must be a positive number.` });
      }
    }

    // Convert MMYYYY to Date objects for sorting/validation
    const parsePhaseDate = (mmYYYY) => {
      const month = parseInt(mmYYYY.substring(0, 2), 10) - 1; // JS months are 0-indexed
      const year = parseInt(mmYYYY.substring(2), 10);
      return new Date(year, month);
    };

    // Check phase order (discovery → build → testing)
    const discoveryEnd = parsePhaseDate(phases.discovery.end);
    const buildStart = parsePhaseDate(phases.build.start);
    const buildEnd = parsePhaseDate(phases.build.end);
    const testingStart = parsePhaseDate(phases.testing.start);

    if (buildStart < discoveryEnd || testingStart < buildEnd) {
      return res.status(400).json({ error: 'Phases must be sequential: discovery → build → testing.' });
    }

    // Save the project
    const data = loadData();
    const newProject = {
      id: `proj-${Date.now()}`,
      name,
      phases,
      // Auto-calculated fields (for GET response)
      totalTeamMembers: requiredPhases.reduce((sum, phase) => sum + phases[phase].teamMembers, 0),
      startDate: phases.discovery.start,
      endDate: phases.testing.end
    };
    data.projects.push(newProject);
    saveData(data);

    res.status(201).json(newProject);
  } catch (error) {
    res.status(500).json({ error: `Failed to create project: ${error.message}` });
  }
});

// --- GET Capacity (Auto-calculated from Projects + Teams) ---
router.get('/capacity', (req, res) => {
  try {
    const data = loadData();
    const { projects } = data;

    const monthlyAllocations = {};
    const monthlyDetails = {};

    projects.forEach(project => {
      const { name, phases } = project;
      Object.entries(phases).forEach(([phaseName, phase]) => {
        const { teamMembers, start, end } = phase;
        const startDate = parseMMYYYY(start);
        const endDate = parseMMYYYY(end);

        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const monthKey = formatMMYYYY(currentDate);

          // Initialize month entry if missing
          if (!monthlyAllocations[monthKey]) {
            monthlyAllocations[monthKey] = { allocated: 0 };
            monthlyDetails[monthKey] = [];
          }

          // Add project/phase if it's active in this month
          monthlyDetails[monthKey].push({
            project: name,
            phase: phaseName,
            teamMembers,
            start,
            end
          });

          monthlyAllocations[monthKey].allocated += teamMembers;
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      });
    });

    // Calculate unallocated members (total team members - allocated)
    const totalTeamMembers = data.teams.reduce((sum, team) => sum + team.memberCount, 0);
    const capacityReport = Object.entries(monthlyAllocations).map(([month, stats]) => ({
      month,
      allocated: stats.allocated,
      unallocated: Math.max(0, totalTeamMembers - stats.allocated), // Prevent negative values
      utilization: (stats.allocated / totalTeamMembers).toFixed(2)
    }));

    // Sort months in ascending order for BOTH details and summary
    const sortMonths = (a, b) => {
      const dateA = parseInt(a.slice(2) + a.slice(0, 2)); // Convert MMYYYY to YYYYMM
      const dateB = parseInt(b.slice(2) + b.slice(0, 2));
      return dateA - dateB;
    };

    // 1. Sort details
    const sortedDetails = {};
    Object.keys(monthlyDetails)
      .sort(sortMonths)
      .forEach(key => {
        sortedDetails[key] = monthlyDetails[key];
      });

    // 2. Sort summary months
    const sortedMonths = capacityReport.sort((a, b) => sortMonths(a.month, b.month));

    res.json({
      summary: {
        totalTeamMembers,
        months: sortedMonths // Now sorted
      },
      details: sortedDetails
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to calculate capacity: ${error.message}` });
  }
});

// Helper: Convert MMYYYY string to Date
const parseMMYYYY = (mmYYYY) => {
  const month = parseInt(mmYYYY.substring(0, 2), 10) - 1;
  const year = parseInt(mmYYYY.substring(2), 10);
  return new Date(year, month);
};

// Helper: Format Date as MMYYYY
const formatMMYYYY = (date) => {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}${year}`;
};

// --- PUT Update Capacity ---
router.put('/capacity', (req, res) => {
  try {
    const { team, month, available, allocated } = req.body;
    const data = loadData();
    const index = data.capacity.findIndex(
      (c) => c.team === team && c.month === month
    );

    const updatedEntry = { 
      team, 
      month, 
      available, 
      allocated,
      lastUpdated: new Date().toISOString()  // Add timestamp
    };

    if (index !== -1) {
      data.capacity[index] = updatedEntry;
    } else {
      data.capacity.push(updatedEntry);
    }

    saveData(data);
    res.json(updatedEntry);
  } catch (error) {
    res.status(400).json({ error: "Invalid capacity data" });
  }
});

// --- Temporary: Reset Teams (for testing) ---
router.delete('/teams', (req, res) => {
  const data = loadData();
  data.teams = [];
  saveData(data);
  res.json({ message: 'All teams cleared.' });
});

/**
 * PUT /api/teams/:name
 * Updates a team's member count in mockData.json.
 */
router.put('/teams/:name', (req, res) => {
  try {
    const { name } = req.params;
    const { memberCount } = req.body;
    const data = loadData();

    // Find the team
    const teamIndex = data.teams.findIndex(team => team.name.toLowerCase() === name.toLowerCase());
    if (teamIndex === -1) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    // Validate input
    if (typeof memberCount !== 'number' || memberCount <= 0) {
      return res.status(400).json({ error: 'Member count must be a positive number.' });
    }

    // Update the team
    data.teams[teamIndex].memberCount = memberCount;
    saveData(data);

    res.json({ message: 'Team updated successfully.', team: data.teams[teamIndex] });
  } catch (error) {
    res.status(500).json({ error: `Failed to update team: ${error.message}` });
  }
});

/**
 * PUT /api/projects/:id
 * Updates an existing project in mockData.json.
 */
router.put('/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, phases } = req.body;
    const data = loadData();

    // Debug logging
    console.log('PUT /projects/', { 
      id, 
      name, 
      phases,
      existingIds: data.projects.map(p => p.id) 
    });

    // Find project
    const projectIndex = data.projects.findIndex(p => p.id === id);
    if (projectIndex === -1) {
      return res.status(404).json({ 
        error: `Project ${id} not found`,
        availableIds: data.projects.map(p => p.id)
      });
    }

    // Validate required phases
    const requiredPhases = ['discovery', 'build', 'testing'];
    if (!phases || requiredPhases.some(phase => !phases[phase])) {
      return res.status(400).json({ 
        error: 'Missing required phases',
        required: requiredPhases 
      });
    }

    // Update project
    const updatedProject = {
      ...data.projects[projectIndex],
      name,
      phases,
      totalTeamMembers: requiredPhases.reduce((sum, phase) => sum + phases[phase].teamMembers, 0),
      startDate: phases.discovery.start,
      endDate: phases.testing.end
    };

    data.projects[projectIndex] = updatedProject;
    saveData(data);

    // Explicitly set JSON headers
    res.setHeader('Content-Type', 'application/json');
    res.json(updatedProject);

  } catch (error) {
    console.error('PUT /projects error:', error);
    // Ensure error responses are JSON too
    res.status(500).setHeader('Content-Type', 'application/json').json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/teams/:name
 * Deletes a team from mockData.json.
 */
router.delete('/teams/:name', (req, res) => {
  try {
    const { name } = req.params;
    const data = loadData();

    // Find the team
    const teamIndex = data.teams.findIndex(team => team.name.toLowerCase() === name.toLowerCase());
    if (teamIndex === -1) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    // Remove the team
    const deletedTeam = data.teams.splice(teamIndex, 1)[0];
    saveData(data);

    res.json({ message: 'Team deleted successfully.', team: deletedTeam });
  } catch (error) {
    res.status(500).json({ error: `Failed to delete team: ${error.message}` });
  }
});

/**
 * DELETE /api/projects/:id
 * Deletes a project from mockData.json.
 */
router.delete('/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = loadData();

    // Find the project
    const projectIndex = data.projects.findIndex(project => project.id === id);
    if (projectIndex === -1) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Remove the project
    const deletedProject = data.projects.splice(projectIndex, 1)[0];
    saveData(data);

    res.json({ message: 'Project deleted successfully.', project: deletedProject });
  } catch (error) {
    res.status(500).json({ error: `Failed to delete project: ${error.message}` });
  }
});

module.exports = router;
