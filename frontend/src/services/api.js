import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

// Projects
export const getProjects = () => axios.get(`${API_BASE}/projects`);
export const addProject = (projectData) => axios.post(`${API_BASE}/projects`, projectData);

// Teams
export const getTeams = () => axios.get(`${API_BASE}/teams`);

// Capacity (optional - not used in current simplified dashboard)
export const getCapacity = () => axios.get(`${API_BASE}/capacity`);
export const updateCapacity = (capacityData) => axios.put(`${API_BASE}/capacity`, capacityData);

// Add error handling interceptor
axios.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
