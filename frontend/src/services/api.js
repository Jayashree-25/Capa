import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:3001/api',  // Backend API URL
  timeout: 5000,
});

export const getProjects = () => API.get('/projects');
export const getCapacity = () => API.get('/capacity');
export const addProject = (project) => API.post('/projects', project);
export const updateCapacity = (capacity) => API.put('/capacity', capacity);
