import api from './auth';

const kanbanService = {
  getColumns: () => api.get('/kanban/columns/').then(r => r.data),
  createColumn: (data) => api.post('/kanban/columns/', data).then(r => r.data),
  updateColumn: (id, data) => api.patch(`/kanban/columns/${id}/`, data).then(r => r.data),
  deleteColumn: (id) => api.delete(`/kanban/columns/${id}/`),
  reorderColumns: (orders) => api.post('/kanban/columns/reorder/', { orders }).then(r => r.data),
};

export default kanbanService;
