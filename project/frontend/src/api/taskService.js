const API_URL = 'http://localhost:8000/api/v1';

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const taskService = {
  // Получить все задачи
  async getTasks(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/tasks/?${queryParams}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки задач');
    const data = await response.json();
    // Возвращаем весь ответ (с пагинацией), чтобы фронтенд мог взять results
    return data;
  },

  // Получить статистику
  async getStats() {
    const response = await fetch(`${API_URL}/tasks/stats/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки статистики');
    return response.json();
  },

  // Получить мои задачи
  async getMyTasks() {
    const response = await fetch(`${API_URL}/tasks/my_tasks/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки моих задач');
    const data = await response.json();
    return data.results || data;
  },

  // Получить просроченные задачи
  async getOverdueTasks() {
    const response = await fetch(`${API_URL}/tasks/overdue/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки просроченных задач');
    const data = await response.json();
    return data.results || data;
  },

  async getTaskById(id) {
    const response = await fetch(`${API_URL}/tasks/${id}/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки задачи');
    return response.json();
  },

  async createTask(taskData) {
    const response = await fetch(`${API_URL}/tasks/`, {
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
    const response = await fetch(`${API_URL}/tasks/${id}/`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(taskData)
    });
    if (!response.ok) throw new Error('Ошибка обновления задачи');
    return response.json();
  },

  async deleteTask(id) {
    const response = await fetch(`${API_URL}/tasks/${id}/`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка удаления задачи');
    return true;
  },

  async changeStatus(id, status) {
    const response = await fetch(`${API_URL}/tasks/${id}/change_status/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Ошибка изменения статуса');
    return response.json();
  },

  async getUsers() {
    const response = await fetch(`${API_URL}/users/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки пользователей');
    const data = await response.json();
    return data.results || data;
  }
};