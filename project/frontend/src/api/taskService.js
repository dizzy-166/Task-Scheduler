// Правильный URL
const API_URL = 'http://localhost:8000';  // Без /api в конце

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const taskService = {
  async getTasks(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    // ВАЖНО: добавляем /api/ перед эндпоинтом
    const response = await fetch(`${API_URL}/api/tasks/?${queryParams}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки задач');
    return response.json();
  },

  async getTaskById(id) {
    const response = await fetch(`${API_URL}/api/tasks/${id}/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки задачи');
    return response.json();
  },

  async createTask(taskData) {
    const response = await fetch(`${API_URL}/api/tasks/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(taskData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка создания задачи');
    }
    return response.json();
  },

  async updateTask(id, taskData) {
    const response = await fetch(`${API_URL}/api/tasks/${id}/`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(taskData)
    });
    if (!response.ok) throw new Error('Ошибка обновления задачи');
    return response.json();
  },

  async deleteTask(id) {
    const response = await fetch(`${API_URL}/api/tasks/${id}/`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка удаления задачи');
    return true;
  },

  async getProjects() {
    // Исправлен путь
    const response = await fetch(`${API_URL}/api/projects/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки проектов');
    return response.json();
  },

  async getUsers() {
    // Исправлен путь
    const response = await fetch(`${API_URL}/api/users/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки пользователей');
    return response.json();
  }
};