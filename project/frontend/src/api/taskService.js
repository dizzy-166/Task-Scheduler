const API_URL = 'http://localhost:8000/api'; // Замените на ваш URL

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
    return response.json();
  },

  // Получить задачу по ID
  async getTaskById(id) {
    const response = await fetch(`${API_URL}/tasks/${id}/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки задачи');
    return response.json();
  },

  // Создать задачу
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

  // Обновить задачу
  async updateTask(id, taskData) {
    const response = await fetch(`${API_URL}/tasks/${id}/`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(taskData)
    });
    if (!response.ok) throw new Error('Ошибка обновления задачи');
    return response.json();
  },

  // Удалить задачу
  async deleteTask(id) {
    const response = await fetch(`${API_URL}/tasks/${id}/`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка удаления задачи');
    return true;
  },

  // Получить проекты для выбора
  async getProjects() {
    const response = await fetch(`${API_URL}/projects/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки проектов');
    return response.json();
  },

  // Получить пользователей для назначения
  async getUsers() {
    const response = await fetch(`${API_URL}/users/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ошибка загрузки пользователей');
    return response.json();
  }
};