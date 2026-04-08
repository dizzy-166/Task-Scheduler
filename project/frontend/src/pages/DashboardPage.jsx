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
    totalChange: '+0',
    inProgress: 0,
    onReview: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await taskService.getTasks();
      organizeTasks(data);
    } catch (err) {
      console.error('Ошибка загрузки задач:', err);
      // Демо-данные на случай ошибки API
      loadDemoData();
    } finally {
      setLoading(false);
    }
  };

  const organizeTasks = (tasksList) => {
    const organized = {
      todo: [],
      inProgress: [],
      onReview: [],
      completed: []
    };

    tasksList.forEach(task => {
      const taskItem = {
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: getPriorityText(task.priority),
        assignee: task.assignee?.full_name || task.assignee?.email || 'Не назначен',
        dueDate: task.due_date,
        estimatedHours: task.estimated_hours,
        status: task.status
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
    
    // Обновляем статистику
    setStats({
      total: tasksList.length,
      totalChange: `+${tasksList.filter(t => t.status === 'new').length}`,
      inProgress: organized.inProgress.length,
      onReview: organized.onReview.length,
      completed: organized.completed.length
    });
  };

  const loadDemoData = () => {
    const demoTasks = {
      todo: [
        {
          id: 1,
          title: 'Подготовка контент-плана',
          priority: 'Средний',
          description: 'Составить план публикаций на апрель-май',
          assignee: 'Дмитрий Козлов',
          timeLeft: '1д 18ч'
        },
        {
          id: 2,
          title: 'Тестирование мобильной версии',
          priority: 'Высокий',
          description: 'Протестировать адаптивность на различных устройствах',
          assignee: 'Дмитрий Козлов',
          timeLeft: '13ч 44м'
        },
        {
          id: 3,
          title: 'Презентация результатов',
          priority: 'Высокий',
          description: 'Подготовить слайд для презентации руководству',
          assignee: 'Павел Новиков',
          timeLeft: '14ч 44м'
        }
      ],
      inProgress: [
        {
          id: 4,
          title: 'Разработка макетов главной страницы',
          priority: 'Высокий',
          description: 'Создать 3 варианта дизайна главной страницы в Figma',
          assignee: 'Мария Иванова',
          timeLeft: '2д 12ч'
        },
        {
          id: 5,
          title: 'Написание документации',
          priority: 'Средний',
          description: 'Документировать все API endpoints',
          assignee: 'Мария Иванова',
          timeLeft: '4д 12ч'
        }
      ],
      onReview: [
        {
          id: 6,
          title: 'Настройка интеграции с API',
          priority: 'Высокий',
          description: 'Подключить CRM к существующим системам через REST API',
          assignee: 'Павел Новиков',
          timeLeft: '3д 11ч'
        },
        {
          id: 7,
          title: 'Код-ревью фронтенд компонентов',
          priority: 'Низкий',
          description: 'Проверить React компоненты на соответствие стандартам',
          assignee: 'Павел Новиков',
          timeLeft: '2д 8ч'
        }
      ],
      completed: [
        {
          id: 8,
          title: 'Настройка CI/CD',
          priority: 'Высокий',
          description: 'Настроить автоматическое развертывание',
          assignee: 'Алексей Смирнов',
          timeLeft: 'Завершено'
        }
      ]
    };
    
    setTasks(demoTasks);
    setStats({
      total: 12,
      totalChange: '+2',
      inProgress: 2,
      onReview: 2,
      completed: 1
    });
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

  const getStatusText = (status) => {
    const statuses = {
      new: 'К выполнению',
      in_progress: 'В работе',
      review: 'На проверке',
      done: 'Завершено',
      cancelled: 'Отменено'
    };
    return statuses[status] || status;
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

  const handleTaskCreated = (newTask) => {
    loadTasks(); // Перезагружаем список задач
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
        <aside className="sidebar">...</aside>
        <main className="main-content">
          <div className="loading-container">
            <div className="spinner-large"></div>
            <p>Загрузка задач...</p>
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
              <span className="stat-change positive">{stats.totalChange}</span>
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
                          {task.assignee[0]}
                        </div>
                        <span>{task.assignee}</span>
                      </div>
                      <div className="task-time">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1"/>
                          <path d="M7 3v4l2 2" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                        <span>{task.timeLeft || formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                      </div>
                    </div>
                  </div>
                ))}
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
                          {task.assignee[0]}
                        </div>
                        <span>{task.assignee}</span>
                      </div>
                      <div className="task-time">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1"/>
                          <path d="M7 3v4l2 2" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                        <span>{task.timeLeft || formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                      </div>
                    </div>
                  </div>
                ))}
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
                          {task.assignee[0]}
                        </div>
                        <span>{task.assignee}</span>
                      </div>
                      <div className="task-time">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1"/>
                          <path d="M7 3v4l2 2" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                        <span>{task.timeLeft || formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                      </div>
                    </div>
                  </div>
                ))}
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
                          {task.assignee[0]}
                        </div>
                        <span>{task.assignee}</span>
                      </div>
                      <div className="task-time completed">
                        <span>✓ Завершено</span>
                      </div>
                    </div>
                  </div>
                ))}
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
                    <span className="meta-assignee">{task.assignee}</span>
                    <span className="meta-time">{task.timeLeft || formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                  </div>
                </div>
              </div>
            ))}
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
              {Array.from({ length: 30 }, (_, i) => i + 1).map(day => (
                <div key={day} className="calendar-day">
                  <span className="day-number">{day}</span>
                  {tasks.todo.some(t => new Date(t.dueDate).getDate() === day) && (
                    <div className="calendar-event">Задача</div>
                  )}
                </div>
              ))}
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