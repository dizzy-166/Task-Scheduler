import { useState, useEffect } from 'react';
import { taskService } from '../api/taskService';
import companyAPI from '../api/companyService';

const TaskModal = ({ isOpen, onClose, onTaskCreated, task, mode = 'create' }) => {
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
      loadCompanyMembers();
      if (mode === 'view' && task) {
        setFormData({
          title: task.title || '',
          description: task.description || '',
          assignee_id: task.assignee?.id || task.assignee_id || task.assignee || '',
          priority: task.priority || 'medium',
          status: task.status || 'new',
          due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '',
          estimated_hours: task.estimated_hours || ''
        });
      } else if (mode === 'create') {
        resetForm();
      }
    }
  }, [isOpen, mode, task]);

  const loadCompanyMembers = async () => {
    try {
      const companyStorage = localStorage.getItem('company-storage');
      if (!companyStorage) { await loadAllUsers(); return; }

      const companyState = JSON.parse(companyStorage);
      const companyId = companyState?.state?.activeCompany?.id;
      if (!companyId) { await loadAllUsers(); return; }

      const response = await companyAPI.getMembers(companyId);
      let membersData = response?.data || response;
      if (membersData?.results && Array.isArray(membersData.results)) {
        membersData = membersData.results;
      }
      
      if (Array.isArray(membersData)) {
        const usersList = membersData.map(member => ({
          id: member.user,
          full_name: member.user_name || member.user_email || 'Неизвестный',
          email: member.user_email || '',
          role: member.role
        }));
        setUsers(usersList);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Ошибка загрузки участников:', err);
      await loadAllUsers();
    }
  };

  const loadAllUsers = async () => {
    try {
      const data = await taskService.getUsers();
      let usersList = [];
      if (Array.isArray(data)) usersList = data;
      else if (data?.results && Array.isArray(data.results)) usersList = data.results;
      else if (data?.data && Array.isArray(data.data)) usersList = data.data;
      setUsers(usersList);
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
        assignee: formData.assignee_id || null,
      };
      
      console.log('Creating task with data:', taskData);
      
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === 'view' ? 'Просмотр задачи' : 'Создание новой задачи'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название задачи *</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Введите название задачи" autoFocus disabled={mode === 'view'} />
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows="4" placeholder="Опишите задачу подробнее..." disabled={mode === 'view'} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Приоритет</label>
              <select name="priority" value={formData.priority} onChange={handleChange} disabled={mode === 'view'}>
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
                <option value="critical">Критический</option>
              </select>
            </div>
            <div className="form-group">
              <label>Статус</label>
              <select name="status" value={formData.status} onChange={handleChange} disabled={mode === 'view'}>
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
            <select name="assignee_id" value={formData.assignee_id} onChange={handleChange} disabled={mode === 'view'}>
              <option value="">Не назначен</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.full_name || user.email || 'Пользователь'}</option>
              ))}
            </select>
            {users.length === 0 && <small style={{ color: 'var(--text-secondary)' }}>Нет доступных участников в компании</small>}
          </div>

          {mode === 'view' && task && (
            <div className="form-row">
              <div className="form-group"><label>Создатель</label><input type="text" value={task.creator?.full_name || task.creator_name || 'Неизвестен'} readOnly /></div>
              <div className="form-group"><label>Дата создания</label><input type="text" value={task.created_at ? new Date(task.created_at).toLocaleString() : 'Неизвестна'} readOnly /></div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group"><label>Дедлайн</label><input type="datetime-local" name="due_date" value={formData.due_date} onChange={handleChange} disabled={mode === 'view'} /></div>
            <div className="form-group"><label>Оценка времени (часы)</label><input type="number" name="estimated_hours" value={formData.estimated_hours} onChange={handleChange} step="0.5" min="0" placeholder="Например: 4.5" disabled={mode === 'view'} /></div>
          </div>

          {error && <div className="error-message global-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>{mode === 'view' ? 'Закрыть' : 'Отмена'}</button>
            {mode !== 'view' && <button type="submit" className="btn-primary" disabled={loading}>{loading ? <span className="spinner"></span> : 'Создать задачу'}</button>}
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;