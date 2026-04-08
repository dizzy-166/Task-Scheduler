import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import TaskModal from '../components/TaskModal';
import { taskService } from '../api/taskService';

const DashboardPage = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('kanban');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
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

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadTasks(),
        loadStats()
      ]);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError('Не удалось загрузить данные. Проверьте подключение к серверу.');
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const data = await taskService.getTasks();
      console.log('Загружены задачи (сырые данные):', data);
      
      // Определяем, где находятся задачи в ответе
      let tasksList = [];
      if (data && data.results && Array.isArray(data.results)) {
        // Пагинированный ответ DRF
        tasksList = data.results;
        console.log('Используем results, найдено задач:', tasksList.length);
      } else if (Array.isArray(data)) {
        // Прямой массив
        tasksList = data;
        console.log('Прямой массив, найдено задач:', tasksList.length);
      } else {
        console.error('Неизвестный формат ответа:', data);
        tasksList = [];
      }
      
      organizeTasks(tasksList);
    } catch (err) {
      console.error('Ошибка загрузки задач:', err);
      setTasks({
        todo: [],
        inProgress: [],
        onReview: [],
        completed: []
      });
    }
  };

  const loadStats = async () => {
    try {
      const data = await taskService.getStats();
      console.log('Статистика:', data);
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
    console.log('organizeTasks получил массив задач:', tasksList);
    
    const organized = {
      todo: [],
      inProgress: [],
      onReview: [],
      completed: []
    };

    if (!tasksList || !Array.isArray(tasksList)) {
      console.error('tasksList не является массивом!');
      setTasks(organized);
      return;
    }

    tasksList.forEach(task => {
      console.log(`Обработка задачи: ${task.title}, статус: "${task.status}"`);
      
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
          console.log(`  → Добавлено в "К выполнению"`);
          break;
        case 'in_progress':
          organized.inProgress.push(taskItem);
          console.log(`  → Добавлено в "В работе"`);
          break;
        case 'review':
          organized.onReview.push(taskItem);
          console.log(`  → Добавлено в "На проверке"`);
          break;
        case 'done':
          organized.completed.push(taskItem);
          console.log(`  → Добавлено в "Завершено"`);
          break;
        default:
          console.log(`  → Неизвестный статус "${task.status}", помещаем в "К выполнению"`);
          organized.todo.push(taskItem);
      }
    });

    console.log('Итоговое распределение:', {
      todo: organized.todo.length,
      inProgress: organized.inProgress.length,
      onReview: organized.onReview.length,
      completed: organized.completed.length
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

  const handleTaskCreated = async (newTask) => {
    console.log('Создана новая задача:', newTask);
    await loadAllData();
    setIsTaskModalOpen(false);
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

  if (loading) {
    return (
      <div className="dashboard">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1 className="logo">TaskFlow Pro</h1>
          </div>
          <div className="sidebar-nav">
            <a href="#" className="nav-item active">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" fill="currentColor"/>
              </svg>
              <span>Главная</span>
            </a>
          </div>
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
            <h1 className="logo">TaskFlow Pro</h1>
          </div>
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
          <h1 className="logo">TaskFlow Pro</h1>
        </div>
        
        <nav className="sidebar-nav">
          <a href="#" className="nav-item active">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" fill="currentColor"/>
            </svg>
            <span>Главная</span>
          </a>
          <a href="#" className="nav-item">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M16 2h-4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 2H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" fill="currentColor"/>
            </svg>
            <span>Мои задачи</span>
          </a>
          <a href="#" className="nav-item">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 4h16v12H2V4zm2 2v2h12V6H4zm0 4v2h12v-2H4z" fill="currentColor"/>
            </svg>
            <span>Проекты</span>
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
            <h2>Дашборд</h2>
            <p>Управление задачами и проектами</p>
          </div>
          <div className="header-actions">
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
            <div className="stat-header">
              <span className="stat-label">Всего задач</span>
            </div>
            <div className="stat-value">{stats.total}</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">В работе</span>
            </div>
            <div className="stat-value">{stats.inProgress}</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">На проверке</span>
            </div>
            <div className="stat-value">{stats.onReview}</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Завершено</span>
            </div>
            <div className="stat-value">{stats.completed}</div>
          </div>
        </div>

        <div className="view-tabs">
          <button 
            className={`tab-btn ${activeView === 'list' ? 'active' : ''}`}
            onClick={() => setActiveView('list')}
          >
            Список
          </button>
          <button 
            className={`tab-btn ${activeView === 'kanban' ? 'active' : ''}`}
            onClick={() => setActiveView('kanban')}
          >
            Канбан
          </button>
          <button 
            className={`tab-btn ${activeView === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveView('calendar')}
          >
            Календарь
          </button>
        </div>

        {activeView === 'kanban' && (
          <div className="kanban-board">
            <div className="kanban-column">
              <div className="column-header">
                <h3>К выполнению</h3>
                <span className="task-count">{tasks.todo.length}</span>
              </div>
              <div className="column-tasks">
                {tasks.todo.map(task => (
                  <div key={task.id} className="task-card">
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
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1"/>
                          <path d="M7 3v4l2 2" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                        <span>{formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.todo.length === 0 && (
                  <div className="empty-column">
                    <p>Нет задач</p>
                  </div>
                )}
              </div>
            </div>

            <div className="kanban-column">
              <div className="column-header">
                <h3>В работе</h3>
                <span className="task-count">{tasks.inProgress.length}</span>
              </div>
              <div className="column-tasks">
                {tasks.inProgress.map(task => (
                  <div key={task.id} className="task-card">
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
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1"/>
                          <path d="M7 3v4l2 2" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                        <span>{formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.inProgress.length === 0 && (
                  <div className="empty-column">
                    <p>Нет задач</p>
                  </div>
                )}
              </div>
            </div>

            <div className="kanban-column">
              <div className="column-header">
                <h3>На проверке</h3>
                <span className="task-count">{tasks.onReview.length}</span>
              </div>
              <div className="column-tasks">
                {tasks.onReview.map(task => (
                  <div key={task.id} className="task-card">
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
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1"/>
                          <path d="M7 3v4l2 2" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                        <span>{formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.onReview.length === 0 && (
                  <div className="empty-column">
                    <p>Нет задач</p>
                  </div>
                )}
              </div>
            </div>

            <div className="kanban-column">
              <div className="column-header">
                <h3>Завершено</h3>
                <span className="task-count">{tasks.completed.length}</span>
              </div>
              <div className="column-tasks">
                {tasks.completed.map(task => (
                  <div key={task.id} className="task-card completed">
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
                      <div className="task-time completed">
                        <span>✓ Завершено</span>
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.completed.length === 0 && (
                  <div className="empty-column">
                    <p>Нет задач</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeView === 'list' && (
          <div className="list-view">
            {[...tasks.todo, ...tasks.inProgress, ...tasks.onReview, ...tasks.completed].map(task => (
              <div key={task.id} className="list-item">
                <div className="list-item-checkbox">
                  <input type="checkbox" />
                </div>
                <div className="list-item-content">
                  <div className="list-item-title">
                    <h4>{task.title}</h4>
                    <span className={`priority-badge ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                  <p className="list-item-desc">{task.description}</p>
                  <div className="list-item-meta">
                    <span className="meta-assignee">👤 {task.assignee}</span>
                    <span className="meta-time">⏱ {formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
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

        {activeView === 'calendar' && (
          <div className="calendar-view">
            <div className="calendar-header">
              <button className="calendar-nav">←</button>
              <h3>Апрель 2026</h3>
              <button className="calendar-nav">→</button>
            </div>
            <div className="calendar-grid">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                <div key={day} className="calendar-weekday">{day}</div>
              ))}
              {Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
                const hasTask = [...tasks.todo, ...tasks.inProgress, ...tasks.onReview].some(
                  t => t.dueDate && new Date(t.dueDate).getDate() === day
                );
                return (
                  <div key={day} className="calendar-day">
                    <span className="day-number">{day}</span>
                    {hasTask && <div className="calendar-event">📋 Задача</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <TaskModal 
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
};

export default DashboardPage;