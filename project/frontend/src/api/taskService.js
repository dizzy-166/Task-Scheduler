import api from './auth';

class TaskService {
  getTasks(params = {}) {
    return api.get('/tasks/', { params }).then(r => r.data);
  }

  getTask(id) {
    return api.get(`/tasks/${id}/`).then(r => r.data);
  }

  createTask(data) {
    return api.post('/tasks/', data).then(r => r.data);
  }

  updateTask(id, data) {
    return api.put(`/tasks/${id}/`, data).then(r => r.data);
  }

  partialUpdateTask(id, data) {
    return api.patch(`/tasks/${id}/`, data).then(r => r.data);
  }

  updateTaskStatus(id, status, columnId = null) {
    const body = columnId ? { status, column_id: columnId } : { status };
    return api.post(`/tasks/${id}/change_status/`, body).then(r => r.data);
  }

  deleteTask(id) {
    return api.delete(`/tasks/${id}/`).then(() => true);
  }

  getStats() {
    return api.get('/tasks/stats/').then(r => r.data);
  }

  getUsers() {
    return api.get('/users/').then(r => r.data);
  }

  getMyTasks() {
    return api.get('/tasks/my_tasks/').then(r => r.data);
  }

  getCreatedByMe() {
    return api.get('/tasks/created_by_me/').then(r => r.data);
  }

  getOverdueTasks() {
    return api.get('/tasks/overdue/').then(r => r.data);
  }
}

export const taskService = new TaskService();
