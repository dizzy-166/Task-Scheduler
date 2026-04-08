import { useState, useEffect } from 'react';
import { taskService } from '../api/taskService';

const TaskModal = ({ isOpen, onClose, onTaskCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee_id: '',
    priority: 'medium',
    status: 'new',
    due_date: '',
    estimated_hours: ''
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      const data = await taskService.getUsers();
      // Проверяем, что data - это массив
      if (Array.isArray(data)) {
        setUsers(data);
      } else if (data.results && Array.isArray(data.results)) {
        // Если API возвращает пагинированный ответ
        setUsers(data.results);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
      setUsers([]);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Название задачи обязательно');
      return;
    }

    setLoading(true);
    try {
      let formattedDueDate = null;
      if (formData.due_date) {
        const date = new Date(formData.due_date);
        if (!isNaN(date.getTime())) {
          formattedDueDate = date.toISOString();
        }
      }

      const taskData = {
        title: formData.title,
        description: formData.description || '',
        priority: formData.priority,
        status: formData.status,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        due_date: formattedDueDate,
        assignee_id: formData.assignee_id || null,
      };
      
      const newTask = await taskService.createTask(taskData);
      
      if (onTaskCreated) {
        onTaskCreated(newTask);
      }
      onClose();
      resetForm();
    } catch (err) {
      console.error('Ошибка создания задачи:', err);
      setError(err.message || 'Ошибка создания задачи');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      assignee_id: '',
      priority: 'medium',
      status: 'new',
      due_date: '',
      estimated_hours: ''
    });
    setError('');
  };

  // Если модальное окно закрыто - не рендерим ничего
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Создание новой задачи</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название задачи *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Введите название задачи"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              placeholder="Опишите задачу подробнее..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Приоритет</label>
              <select name="priority" value={formData.priority} onChange={handleChange}>
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
                <option value="critical">Критический</option>
              </select>
            </div>

            <div className="form-group">
              <label>Статус</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="new">Новая</option>
                <option value="in_progress">В работе</option>
                <option value="review">На проверке</option>
                <option value="done">Завершена</option>
                <option value="cancelled">Отменена</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Исполнитель</label>
            <select name="assignee_id" value={formData.assignee_id} onChange={handleChange}>
              <option value="">Не назначен</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.email || user.username || 'Пользователь'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Дедлайн</label>
              <input
                type="datetime-local"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Оценка времени (часы)</label>
              <input
                type="number"
                name="estimated_hours"
                value={formData.estimated_hours}
                onChange={handleChange}
                step="0.5"
                min="0"
                placeholder="Например: 4.5"
              />
            </div>
          </div>

          {error && <div className="error-message global-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Создать задачу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;