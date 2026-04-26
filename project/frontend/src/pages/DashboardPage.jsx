import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import useCompanyStore from '../store/companyStore';
import { useNavigate } from 'react-router-dom';
import TaskModal from '../components/TaskModal';
import CompanySwitcher from '../components/CompanySwitcher';
import { taskService } from '../api/taskService';
import companyAPI from '../api/companyService';

const DashboardPage = () => {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { activeCompany } = useCompanyStore();
  const navigate = useNavigate();
  
  const [activeView, setActiveView] = useState('kanban');
  const [taskScope, setTaskScope] = useState('all');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasks, setTasks] = useState({
    todo: [],
    inProgress: [],
    onReview: [],
    completed: []
  });
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    onReview: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Состояние для управления компанией
  const [companyMembers, setCompanyMembers] = useState([]);
  const [invitedMembers, setInvitedMembers] = useState([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (activeCompany) {
      console.log('Active company changed:', activeCompany);
      loadAllData();
      loadCompanyMembers();
    } else {
      console.log('No active company');
      setLoading(false);
    }
  }, [activeCompany]);

  const computeStatsFromTasks = (tasksList) => {
    const counts = {
      total: tasksList.length,
      inProgress: 0,
      onReview: 0,
      completed: 0,
    };

    tasksList.forEach(task => {
      if (task.status === 'in_progress') counts.inProgress += 1;
      if (task.status === 'review') counts.onReview += 1;
      if (task.status === 'done') counts.completed += 1;
    });

    setStats(counts);
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const tasksList = await loadTasks(taskScope);
      if (taskScope === 'all') {
        await loadStats();
      } else {
        computeStatsFromTasks(tasksList);
      }
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError('Не удалось загрузить данные. Проверьте подключение к серверу.');
    } finally {
      setLoading(false);
    }
  };

  const normalizeTaskResponse = (data) => {
    if (data && data.results && Array.isArray(data.results)) {
      return data.results;
    }
    if (Array.isArray(data)) {
      return data;
    }
    console.error('Неизвестный формат ответа:', data);
    return [];
  };

  const mergeTaskLists = (primary = [], secondary = []) => {
    const mergedMap = new Map();
    [...primary, ...secondary].forEach(task => {
      if (!mergedMap.has(task.id)) {
        mergedMap.set(task.id, task);
      }
    });
    return Array.from(mergedMap.values());
  };

  const loadTasks = async (scope = taskScope) => {
    try {
      let tasksList = [];

      if (scope === 'mine') {
        const [assignedData, createdData] = await Promise.all([
          taskService.getMyTasks(),
          taskService.getCreatedByMe(),
        ]);
        const assignedTasks = normalizeTaskResponse(assignedData);
        const createdTasks = normalizeTaskResponse(createdData);
        tasksList = mergeTaskLists(assignedTasks, createdTasks);
      } else {
        const data = await taskService.getTasks();
        tasksList = normalizeTaskResponse(data);
      }

      console.log(`Загружены задачи (${scope}):`, tasksList);
      organizeTasks(tasksList);
      return tasksList;
    } catch (err) {
      console.error('Ошибка загрузки задач:', err);
      setTasks({
        todo: [],
        inProgress: [],
        onReview: [],
        completed: []
      });
      throw err;
    }
  };

  const handleScopeChange = async (scope) => {
    if (scope === taskScope) return;
    setTaskScope(scope);
    setLoading(true);
    setError(null);

    try {
      const tasksList = await loadTasks(scope);
      if (scope === 'all') {
        await loadStats();
      } else {
        computeStatsFromTasks(tasksList);
      }
    } catch (err) {
      console.error('Ошибка загрузки задач:', err);
      setError('Не удалось загрузить задачи. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await taskService.getStats();
      setStats({
        total: data.total || 0,
        inProgress: data.by_status?.in_progress || 0,
        onReview: data.by_status?.review || 0,
        completed: data.by_status?.done || 0
      });
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    }
  };

  const organizeTasks = (tasksList) => {
    const organized = {
      todo: [],
      inProgress: [],
      onReview: [],
      completed: []
    };

    if (!tasksList || !Array.isArray(tasksList)) {
      setTasks(organized);
      return;
    }

    tasksList.forEach(task => {
      const taskItem = {
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: task.priority_display || getPriorityText(task.priority),
        assignee: task.assignee_name || 'Не назначен',
        dueDate: task.due_date,
        estimatedHours: task.estimated_hours,
        status: task.status,
        creator: task.creator_name,
        createdAt: task.created_at
      };

      switch(task.status) {
        case 'new':
          organized.todo.push(taskItem);
          break;
        case 'in_progress':
          organized.inProgress.push(taskItem);
          break;
        case 'review':
          organized.onReview.push(taskItem);
          break;
        case 'done':
          organized.completed.push(taskItem);
          break;
        default:
          organized.todo.push(taskItem);
      }
    });
    
    setTasks(organized);
  };

  const getPriorityText = (priority) => {
    const priorities = {
      low: 'Низкий',
      medium: 'Средний',
      high: 'Высокий',
      critical: 'Критический'
    };
    return priorities[priority] || 'Средний';
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'Критический': return 'priority-critical';
      case 'Высокий': return 'priority-high';
      case 'Средний': return 'priority-medium';
      case 'Низкий': return 'priority-low';
      default: return 'priority-medium';
    }
  };

  const getStatusByColumn = (columnId) => {
    const statusMap = {
      'todo': 'new',
      'inProgress': 'in_progress',
      'onReview': 'review',
      'completed': 'done'
    };
    return statusMap[columnId];
  };

  const onDragStart = (e, task, sourceColumn) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('sourceColumn', sourceColumn);
    e.dataTransfer.effectAllowed = 'move';
    const dragData = { task, sourceColumn };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.currentTarget.style.opacity = '0.5';
  };

  const onDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    document.querySelectorAll('.kanban-column').forEach(col => {
      col.classList.remove('drag-over');
    });
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDragEnter = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const onDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const onDrop = async (e, targetColumn) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const taskId = e.dataTransfer.getData('taskId');
    const sourceColumn = e.dataTransfer.getData('sourceColumn');
    
    if (!taskId || !sourceColumn || sourceColumn === targetColumn) {
      return;
    }
    
    const sourceTasks = [...tasks[sourceColumn]];
    const taskToMove = sourceTasks.find(t => t.id === taskId);
    
    if (!taskToMove) {
      return;
    }
    
    const newStatus = getStatusByColumn(targetColumn);
    if (!newStatus) {
      return;
    }
    
    const updatedTasks = { ...tasks };
    updatedTasks[sourceColumn] = updatedTasks[sourceColumn].filter(t => t.id !== taskId);
    const updatedTask = { ...taskToMove, status: newStatus };
    updatedTasks[targetColumn] = [...updatedTasks[targetColumn], updatedTask];
    
    setTasks(updatedTasks);
    
    setIsUpdating(true);
    try {
      await taskService.updateTaskStatus(taskId, newStatus);
      await loadStats();
    } catch (error) {
      console.error('Ошибка при обновлении статуса:', error);
      await loadTasks();
      alert('Не удалось переместить задачу. Попробуйте еще раз.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleName = (role) => {
    const roles = {
      admin: 'Администратор',
      manager: 'Менеджер',
      executor: 'Исполнитель',
      observer: 'Наблюдатель',
    };
    return roles[role] || role;
  };

  const handleTaskClick = async (task) => {
    try {
      const fullTask = await taskService.getTask(task.id);
      setSelectedTask(fullTask);
      setIsTaskModalOpen(true);
    } catch (error) {
      console.error('Ошибка загрузки задачи:', error);
      setSelectedTask(task);
      setIsTaskModalOpen(true);
    }
  };

  const handleTaskModalClose = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskCreated = async (newTask) => {
    await loadAllData();
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  // ==========================================
  // Функции для управления компанией (ИСПРАВЛЕНО)
  // ==========================================
  
  // Безопасное извлечение массива из ответа API
  const safeExtractArray = (response, label = 'data') => {
    console.log(`Extracting ${label}:`, response);
    
    // Если ответ от axios - данные в response.data
    const data = response?.data || response;
    
    // Если это массив - возвращаем его
    if (Array.isArray(data)) {
      console.log(`${label} is array:`, data.length);
      return data;
    }
    
    // Если есть поле results
    if (data?.results && Array.isArray(data.results)) {
      console.log(`${label} has results:`, data.results.length);
      return data.results;
    }
    
    // Если это объект с ключами (возможно пагинация)
    if (typeof data === 'object' && data !== null) {
      // Пробуем найти первый массив в объекте
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          console.log(`${label} found array in key "${key}":`, data[key].length);
          return data[key];
        }
      }
    }
    
    console.warn(`${label} is not an array, returning []`);
    return [];
  };

  const loadCompanyMembers = async () => {
    if (!activeCompany?.id) {
      console.log('No active company ID');
      return;
    }
    
    console.log('Loading members for company:', activeCompany.id);
    
    try {
      // Загружаем участников
      const membersResponse = await companyAPI.getMembers(activeCompany.id);
      const membersList = safeExtractArray(membersResponse, 'members');
      console.log('Members list:', membersList);
      setCompanyMembers(membersList);
      
      // Загружаем приглашенных
      try {
        const invitedResponse = await companyAPI.getInvitedMembers(activeCompany.id);
        const invitedList = safeExtractArray(invitedResponse, 'invited');
        console.log('Invited list:', invitedList);
        setInvitedMembers(invitedList);
      } catch (err) {
        console.error('Ошибка загрузки приглашенных:', err);
        setInvitedMembers([]);
      }
    } catch (err) {
      console.error('Ошибка загрузки участников:', err);
      setCompanyMembers([]);
      setInvitedMembers([]);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Введите email');
      return;
    }
    
    if (!activeCompany?.id) {
      setInviteError('Компания не выбрана');
      return;
    }
    
    console.log('Active company:', activeCompany);
    console.log('Invite data:', { email: inviteEmail, role: inviteRole });
    
    try {
      const { inviteMember } = useCompanyStore.getState();
      const result = await inviteMember(activeCompany.id, {
        email: inviteEmail,
        role: inviteRole
      });
      
      if (result.success) {
        setIsInviteModalOpen(false);
        setInviteEmail('');
        setInviteRole('member');
        setInviteError('');
        await loadCompanyMembers();
      } else {
        setInviteError(result.error || 'Ошибка приглашения');
      }
    } catch (err) {
      console.error('Ошибка приглашения:', err);
      setInviteError('Ошибка приглашения: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleChangeMemberRole = async (userId, newRole) => {
    if (!activeCompany?.id) return;
    
    try {
      await companyAPI.changeMemberRole(activeCompany.id, userId, newRole);
      await loadCompanyMembers();
    } catch (err) {
      console.error('Ошибка изменения роли:', err);
      alert('Не удалось изменить роль');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!activeCompany?.id) return;
    if (!confirm('Вы уверены, что хотите удалить этого участника?')) return;
    
    try {
      await companyAPI.removeMember(activeCompany.id, userId);
      await loadCompanyMembers();
    } catch (err) {
      console.error('Ошибка удаления участника:', err);
      alert('Не удалось удалить участника');
    }
  };

  const formatTimeLeft = (dueDate, estimatedHours) => {
    if (!dueDate && !estimatedHours) return '—';
    
    if (dueDate) {
      const now = new Date();
      const due = new Date(dueDate);
      const diff = due - now;
      
      if (diff <= 0) return 'Просрочено';
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days > 0) return `${days}д ${hours}ч`;
      if (hours > 0) return `${hours}ч`;
      return 'Менее часа';
    }
    
    if (estimatedHours) {
      const days = Math.floor(estimatedHours / 24);
      const hours = estimatedHours % 24;
      if (days > 0) return `${days}д ${hours}ч`;
      return `${hours}ч`;
    }
    
    return '—';
  };

  if (!activeCompany) {
    return (
      <div className="dashboard">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1 className="logo">ControlFlow</h1>
          </div>
          <nav className="sidebar-nav">
            <CompanySwitcher />
          </nav>
          <div className="sidebar-footer">
            <div className="user-info-sidebar">
              <div className="user-avatar">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <div className="user-details-sidebar">
                <div className="user-name">{user?.full_name || user?.email}</div>
                <div className="user-role">{getRoleName(user?.role)}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              <span>Выйти</span>
            </button>
          </div>
        </aside>
        <main className="main-content">
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <h2>Выберите или создайте компанию</h2>
            <p>Для начала работы создайте компанию или примите приглашение</p>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1 className="logo">ControlFlow</h1>
          </div>
          <nav className="sidebar-nav">
            <CompanySwitcher />
          </nav>
        </aside>
        <main className="main-content">
          <div className="loading-container">
            <div className="spinner-large"></div>
            <p>Загрузка задач...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1 className="logo">ControlFlow</h1>
          </div>
          <nav className="sidebar-nav">
            <CompanySwitcher />
          </nav>
        </aside>
        <main className="main-content">
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h3>Ошибка загрузки</h3>
            <p>{error}</p>
            <button className="btn-primary" onClick={loadAllData}>Повторить</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">ControlFlow</h1>
        </div>
        
        <nav className="sidebar-nav">
          <CompanySwitcher />
          
          <a
            href="#"
            className={`nav-item ${taskScope === 'all' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); handleScopeChange('all'); }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" fill="currentColor"/>
            </svg>
            <span>Все задачи</span>
          </a>
          
          <a
            href="#"
            className={`nav-item ${taskScope === 'mine' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); handleScopeChange('mine'); }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2a4 4 0 100 8 4 4 0 000-8zM3 18v-2a4 4 0 014-4h6a4 4 0 014 4v2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
            <span>Мои задачи</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info-sidebar">
            <div className="user-avatar">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div className="user-details-sidebar">
              <div className="user-name">{user?.full_name || user?.email}</div>
              <div className="user-role">{getRoleName(user?.role)}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M7 1H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M13 13l4-4-4-4M17 9H7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <div className="header-title">
            <h2>{activeCompany?.name} - {taskScope === 'all' ? 'Дашборд' : 'Мои задачи'}</h2>
            <p>Управление задачами и проектами</p>
          </div>
          <div className="header-actions">
            <button className="theme-toggle-btn" onClick={toggleTheme} title={`Переключить на ${theme === 'light' ? 'тёмную' : 'светлую'} тему`}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button className="btn-new-task" onClick={() => setIsTaskModalOpen(true)}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Новая задача
            </button>
          </div>
        </header>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Всего задач</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-label">В работе</div>
            <div className="stat-value" style={{ color: '#2196F3' }}>{stats.inProgress}</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-label">На проверке</div>
            <div className="stat-value" style={{ color: '#FF9800' }}>{stats.onReview}</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-label">Завершено</div>
            <div className="stat-value" style={{ color: '#4CAF50' }}>{stats.completed}</div>
          </div>
        </div>

        <div className="view-tabs">
          <button 
            className={`tab-btn ${activeView === 'kanban' ? 'active' : ''}`}
            onClick={() => setActiveView('kanban')}
          >
            Канбан
          </button>
          <button 
            className={`tab-btn ${activeView === 'list' ? 'active' : ''}`}
            onClick={() => setActiveView('list')}
          >
            Список
          </button>
          <button 
            className={`tab-btn ${activeView === 'company' ? 'active' : ''}`}
            onClick={() => setActiveView('company')}
          >
            Компания
          </button>
        </div>

        {activeView === 'kanban' && (
          <div className="kanban-board">
            {[
              { id: 'todo', title: 'К выполнению', tasks: tasks.todo },
              { id: 'inProgress', title: 'В работе', tasks: tasks.inProgress },
              { id: 'onReview', title: 'На проверке', tasks: tasks.onReview },
              { id: 'completed', title: 'Завершено', tasks: tasks.completed }
            ].map(column => (
              <div 
                key={column.id}
                className="kanban-column"
                onDragOver={onDragOver}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, column.id)}
              >
                <div className="column-header">
                  <h3>{column.title}</h3>
                  <span className="task-count">{column.tasks.length}</span>
                </div>
                <div className="column-tasks">
                  {column.tasks.map(task => (
                    <div
                      key={task.id}
                      className={`task-card ${column.id === 'completed' ? 'completed' : ''}`}
                      draggable={!isUpdating}
                      onDragStart={(e) => onDragStart(e, task, column.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => handleTaskClick(task)}
                    >
                      <div className="task-header">
                        <h4>{task.title}</h4>
                        <span className={`priority-badge ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="task-description">{task.description}</p>
                      <div className="task-footer">
                        <div className="task-assignee">
                          <div className="assignee-avatar">
                            {task.assignee && task.assignee[0] ? task.assignee[0] : '?'}
                          </div>
                          <span>{task.assignee}</span>
                        </div>
                        <div className="task-time">
                          <span>{formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {column.tasks.length === 0 && (
                    <div className="empty-column">
                      <p>Нет задач</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeView === 'list' && (
          <div className="list-view">
            {[...tasks.todo, ...tasks.inProgress, ...tasks.onReview, ...tasks.completed].map(task => (
              <div key={task.id} className="list-item" onClick={() => handleTaskClick(task)}>
                <div className="list-item-content">
                  <div className="list-item-title">
                    <h4>{task.title}</h4>
                    <span className={`priority-badge ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                  <p className="list-item-desc">{task.description}</p>
                  <div className="list-item-meta">
                    <span>👤 {task.assignee}</span>
                    <span>⏱ {formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                  </div>
                </div>
              </div>
            ))}
            {[...tasks.todo, ...tasks.inProgress, ...tasks.onReview, ...tasks.completed].length === 0 && (
              <div className="empty-state">
                <p>Нет задач. Создайте первую задачу!</p>
              </div>
            )}
          </div>
        )}

        {activeView === 'company' && (
          <div className="company-management">
            <div className="company-header">
              <h2>Управление компанией</h2>
              {activeCompany && (
                <button 
                  className="btn-primary"
                  onClick={() => setIsInviteModalOpen(true)}
                >
                  + Пригласить участника
                </button>
              )}
            </div>

            <div className="company-info">
              <div className="info-card">
                <h3>{activeCompany?.name || 'Компания не выбрана'}</h3>
                <p>{activeCompany?.description || 'Выберите компанию в переключателе выше'}</p>
                {activeCompany && (
                  <div className="company-stats">
                    <span>👥 {Array.isArray(companyMembers) ? companyMembers.length : 0} участников</span>
                    <span>📨 {Array.isArray(invitedMembers) ? invitedMembers.length : 0} приглашений</span>
                  </div>
                )}
              </div>
            </div>

            <div className="members-section">
              <h3>Активные участники</h3>
              <div className="members-list">
                {Array.isArray(companyMembers) && companyMembers.map(member => (
                  <div key={member.id} className="member-item">
                    <div className="member-info">
                      <div className="member-avatar">
                        {member.user_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="member-details">
                        <h4>{member.user_name || member.user_email}</h4>
                        <p>{member.user_email}</p>
                        <span className="member-role">{member.role_display || member.role}</span>
                      </div>
                    </div>
                    <div className="member-actions">
                      {member.role !== 'owner' && (
                        <>
                          <select
                            value={member.role}
                            onChange={(e) => handleChangeMemberRole(member.user, e.target.value)}
                            className="role-select"
                          >
                            <option value="member">Участник</option>
                            <option value="admin">Администратор</option>
                          </select>
                          <button 
                            className="btn-danger btn-small"
                            onClick={() => handleRemoveMember(member.user)}
                          >
                            Удалить
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {(!Array.isArray(companyMembers) || companyMembers.length === 0) && (
                  <div className="empty-state">
                    <p>Нет активных участников</p>
                  </div>
                )}
              </div>
            </div>

            {Array.isArray(invitedMembers) && invitedMembers.length > 0 && (
              <div className="invited-section">
                <h3>Ожидают подтверждения</h3>
                <div className="members-list">
                  {invitedMembers.map(member => (
                    <div key={member.id} className="member-item invited">
                      <div className="member-info">
                        <div className="member-avatar">?</div>
                        <div className="member-details">
                          <h4>{member.user_email || member.user_name}</h4>
                          <p>Приглашение отправлено</p>
                          <span className="member-role">{member.role_display || member.role}</span>
                        </div>
                      </div>
                      <div className="member-status">
                        <span className="status-badge">Ожидает</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <TaskModal 
        isOpen={isTaskModalOpen}
        onClose={handleTaskModalClose}
        onTaskCreated={handleTaskCreated}
        task={selectedTask}
        mode={selectedTask ? 'view' : 'create'}
      />

      {/* Модальное окно приглашения участника */}
      {isInviteModalOpen && (
        <div className="modal-overlay" onClick={() => setIsInviteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Пригласить участника</h3>
              <button className="modal-close" onClick={() => setIsInviteModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleInviteMember(); }}>
              <div className="form-group">
                <label>Email участника *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  autoFocus
                />
              </div>
              
              <div className="form-group">
                <label>Роль</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="member">Участник</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              
              {inviteError && <div className="error-message">{inviteError}</div>}
              
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsInviteModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  Отправить приглашение
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {isUpdating && (
        <div className="updating-overlay">
          <div className="updating-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;