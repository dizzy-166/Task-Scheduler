import api from './auth';

const projectService = {
  getProjects: () => api.get('/projects/').then(r => r.data),
  createProject: (data) => api.post('/projects/', data).then(r => r.data),
  updateProject: (id, data) => api.patch(`/projects/${id}/`, data).then(r => r.data),
  deleteProject: (id) => api.delete(`/projects/${id}/`),
};

export default projectService;
