const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/mockData.json');

// Helper: Load and save JSON data
const loadData = () => JSON.parse(fs.readFileSync(dataPath));
const saveData = (data) => fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

// --- GET Projects ---
router.get('/projects', (req, res) => {
  const data = loadData();
  res.json(data.projects);
});

// --- POST New Project ---
router.post('/projects', (req, res) => {
  const data = loadData();
  const newProject = req.body;
  newProject.id = `proj-${Date.now()}`; // Simple unique ID

  data.projects.push(newProject);
  saveData(data);

  res.status(201).json({ message: 'Project added', project: newProject });
});

// --- GET Capacity ---
router.get('/capacity', (req, res) => {
  const data = loadData();
  res.json(data.capacity);
});

// --- PUT Update Capacity ---
router.put('/capacity', (req, res) => {
  const { team, month, available, allocated } = req.body;
  const data = loadData();

  const index = data.capacity.findIndex(
    (c) => c.team === team && c.month === month
  );

  if (index !== -1) {
    data.capacity[index] = { team, month, available, allocated };
  } else {
    data.capacity.push({ team, month, available, allocated });
  }

  saveData(data);
  res.json({ message: 'Capacity updated', capacity: { team, month, available, allocated } });
});

module.exports = router;
