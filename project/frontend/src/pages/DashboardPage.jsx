import { useState } from 'react';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('kanban'); // kanban, list, calendar

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

  // Статистика
  const stats = {
    total: 12,
    totalChange: '+2',
    inProgress: 1,
    onReview: 5,
    completed: 4
  };

  // Данные для канбан-доски
  const tasks = {
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

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'Высокий': return 'priority-high';
      case 'Средний': return 'priority-medium';
      case 'Низкий': return 'priority-low';
      default: return '';
    }
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
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

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="main-header">
          <div className="header-title">
            <h2>Дашборд</h2>
            <p>Управление задачами и проектами</p>
          </div>
          <div className="header-actions">
            <button className="btn-new-task">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Новая задача
            </button>
          </div>
        </header>

        {/* Stats Cards */}
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

        {/* View Tabs */}
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

        {/* Kanban Board */}
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
                        <span>{task.timeLeft}</span>
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
                        <span>{task.timeLeft}</span>
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
                        <span>{task.timeLeft}</span>
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
                        <span>✓ {task.timeLeft}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* List View */}
        {activeView === 'list' && (
          <div className="list-view">
            {Object.entries(tasks).map(([status, taskList]) => (
              taskList.map(task => (
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
                      <span className="meta-time">{task.timeLeft}</span>
                    </div>
                  </div>
                </div>
              ))
            ))}
          </div>
        )}

        {/* Calendar View */}
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
                  {day === 15 && <div className="calendar-event">Подготовка контент-плана</div>}
                  {day === 20 && <div className="calendar-event">Тестирование мобильной версии</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;