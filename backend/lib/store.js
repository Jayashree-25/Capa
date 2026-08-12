const fs = require('fs');
const path = require('path');

const DEFAULT_DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '../data/mockData.json');

let dataFile = DEFAULT_DATA_FILE;

const setDataFile = (filePath) => {
  dataFile = filePath;
};

const loadData = () => {
  const raw = fs.readFileSync(dataFile, 'utf8');
  const data = JSON.parse(raw);
  if (!data.people) data.people = [];
  if (!data.projects) data.projects = [];
  if (!data.tasks) data.tasks = [];
  if (!data.teams) data.teams = [];
  if (!data.capacity) data.capacity = [];
  return data;
};

const saveData = (data) => {
  const tmpFile = `${dataFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, dataFile);
};

module.exports = { loadData, saveData, setDataFile };