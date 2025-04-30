import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

// Projects
export const getProjects = () => axios.get(`${API_BASE}/projects`);
export const addProject = (projectData) => axios.post(`${API_BASE}/projects`, projectData);

// Capacity
export const getCapacity = () => axios.get(`${API_BASE}/capacity`);
export const updateCapacity = (capacityData) => axios.put(`${API_BASE}/capacity`, capacityData);
