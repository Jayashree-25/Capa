import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// People
export const getPeople = () => axios.get(`${API_BASE}/people`);
export const createPerson = (data) => axios.post(`${API_BASE}/people`, data);
export const updatePerson = (id, data) => axios.put(`${API_BASE}/people/${id}`, data);
export const deletePerson = (id) => axios.delete(`${API_BASE}/people/${id}`);

// Teams (distinct team names, for filters)
export const getTeamNames = () => axios.get(`${API_BASE}/teams`);

// Projects
export const getProjects = () => axios.get(`${API_BASE}/projects`);
export const createProject = (data) => axios.post(`${API_BASE}/projects`, data);
export const deleteProject = (id) => axios.delete(`${API_BASE}/projects/${id}`);

// Tasks
export const getTasks = () => axios.get(`${API_BASE}/tasks`);
export const createTask = (data) => axios.post(`${API_BASE}/tasks`, data);
export const updateTask = (id, data) => axios.put(`${API_BASE}/tasks/${id}`, data);
export const deleteTask = (id) => axios.delete(`${API_BASE}/tasks/${id}`);

// Capacity report
export const getLoadReport = (params) => axios.get(`${API_BASE}/reports/load`, { params });