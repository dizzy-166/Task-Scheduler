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

  getReport(params = {}) {
    return api.get('/tasks/report/', { params }).then(r => r.data);
  }

  getAIAnalysis(stats, companyName) {
    return api.post('/ai/analyze/', { stats, company_name: companyName }).then(r => r.data);
  }

  generateAITasks(data) {
    return api.post('/tasks/ai-generate/', data).then(r => r.data);
  }

  bulkCreateTasks(data) {
    return api.post('/tasks/ai-bulk-create/', data).then(r => r.data);
  }

  archiveTask(id) {
    return api.post(`/tasks/${id}/archive/`).then(r => r.data);
  }

  unarchiveTask(id) {
    return api.post(`/tasks/${id}/unarchive/`).then(r => r.data);
  }

  getArchivedTasks(params = {}) {
    return api.get('/tasks/archived/', { params }).then(r => r.data);
  }

  getComments(taskId) {
    return api.get(`/tasks/${taskId}/comments/`).then(r => r.data);
  }

  addComment(taskId, text) {
    return api.post(`/tasks/${taskId}/comments/`, { text }).then(r => r.data);
  }

  deleteComment(taskId, commentId) {
    return api.delete(`/tasks/${taskId}/comments/${commentId}/`);
  }

  startTimer(taskId) {
    return api.post(`/tasks/${taskId}/start_timer/`).then(r => r.data);
  }
  stopTimer(taskId) {
    return api.post(`/tasks/${taskId}/stop_timer/`).then(r => r.data);
  }
  getActiveTimer(taskId) {
    return api.get(`/tasks/${taskId}/active_timer/`).then(r => r.data);
  }

  getSubtasks(taskId) {
    return api.get(`/tasks/${taskId}/subtasks/`).then(r => r.data);
  }
  createSubtask(parentId, data) {
    return api.post('/tasks/', { ...data, parent_task: parentId }).then(r => r.data);
  }
  updateSubtaskStatus(subtaskId, newStatus) {
    return api.patch(`/tasks/${subtaskId}/`, { status: newStatus }).then(r => r.data);
  }
}

export const taskService = new TaskService();
