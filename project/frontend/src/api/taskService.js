// Исправлено: используем /api/v1 как в auth.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

class TaskService {
  constructor() {
    this.baseURL = API_URL;
  }

  getHeaders() {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async getTasks(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = `${this.baseURL}/tasks/${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }

  async getTask(id) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${id}/`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching task:', error);
      throw error;
    }
  }

  async createTask(taskData) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(taskData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create task');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async updateTask(id, taskData) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${id}/`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(taskData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async updateTaskStatus(id, status) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${id}/change_status/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update task status');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating task status:', error);
      throw error;
    }
  }

  async partialUpdateTask(id, taskData) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${id}/`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(taskData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error partially updating task:', error);
      throw error;
    }
  }

  async deleteTask(id) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${id}/`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      const response = await fetch(`${this.baseURL}/tasks/stats/`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }

  async getUsers() {
    try {
      const response = await fetch(`${this.baseURL}/users/`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async getMyTasks() {
    try {
      const response = await fetch(`${this.baseURL}/tasks/my_tasks/`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching my tasks:', error);
      throw error;
    }
  }

  async getOverdueTasks() {
    try {
      const response = await fetch(`${this.baseURL}/tasks/overdue/`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching overdue tasks:', error);
      throw error;
    }
  }
}

export const taskService = new TaskService();