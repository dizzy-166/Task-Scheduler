import { useState, useEffect, useRef } from 'react';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import useCompanyStore from '../store/companyStore';
import useProjectStore from '../store/projectStore';
import { useNavigate } from 'react-router-dom';
import TaskModal from '../components/TaskModal';
import CompanySwitcher from '../components/CompanySwitcher';
import ProjectSwitcher from '../components/ProjectSwitcher';
import MemberActionsMenu from '../components/MemberActionsMenu';
import RolesPanel from '../components/RolesPanel';
import { taskService } from '../api/taskService';
import companyAPI from '../api/companyService';
import kanbanService from '../api/kanbanService';

const DashboardPage = () => {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { activeCompany, companies, deleteCompany } = useCompanyStore();
  const { activeProject } = useProjectStore();
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState('kanban');
  const [taskScope, setTaskScope] = useState('all');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasks, setTasks] = useState({});
  const [columns, setColumns] = useState([]);
  const [stats, setStats] = useState({ total: 0, inProgress: 0, onReview: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Company management state
  const [companyMembers, setCompanyMembers] = useState([]);
  const [invitedMembers, setInvitedMembers] = useState([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteError, setInviteError] = useState('');
  const [selectedInviteCompanyId, setSelectedInviteCompanyId] = useState(activeCompany?.id || '');
  const [showDeleteCompanyModal, setShowDeleteCompanyModal] = useState(false);
  const [deleteCompanyError, setDeleteCompanyError] = useState('');
  const [showRolesPanel, setShowRolesPanel] = useState(false);
  const [availableCustomRoles, setAvailableCustomRoles] = useState([]);

  // Kanban column management
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [editingColumn, setEditingColumn] = useState(null);
  const [columnForm, setColumnForm] = useState({ name: '', color: '#6B7280' });
  const [columnError, setColumnError] = useState('');

  const currentUserRole = companyMembers.find(m => m.user === user?.id)?.role || 'member';
  const canManageColumns = currentUserRole === 'owner' || currentUserRole === 'admin';

  // ── Load everything when company / project changes ─────────────────────────
  useEffect(() => {
    if (activeCompany) {
      loadAllData();
      loadCompanyMembers();
      loadCustomRoles();
      loadColumns();
      setSelectedInviteCompanyId(activeCompany.id);
    } else {
      setLoading(false);
    }
  }, [activeCompany, activeProject]);

  // ── Columns ─────────────────────────────────────────────────────────────────
  const loadColumns = async () => {
    try {
      const data = await kanbanService.getColumns();
      const cols = Array.isArray(data) ? data : (data.results || []);
      setColumns(cols);
      return cols;
    } catch (err) {
      console.error('Ошибка загрузки колонок:', err);
      return [];
    }
  };

  const handleSaveColumn = async () => {
    if (!columnForm.name.trim()) {
      setColumnError('Введите название');
      return;
    }
    try {
      if (editingColumn) {
        await kanbanService.updateColumn(editingColumn.id, columnForm);
      } else {
        await kanbanService.createColumn(columnForm);
      }
      await loadColumns();
      setShowColumnModal(false);
      setEditingColumn(null);
      setColumnForm({ name: '', color: '#6B7280' });
      setColumnError('');
    } catch (err) {
      setColumnError(err.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const handleDeleteColumn = async (col) => {
    if (!confirm(`Удалить колонку "${col.name}"? Задачи останутся без колонки.`)) return;
    await kanbanService.deleteColumn(col.id);
    await loadColumns();
  };

  // ── Tasks ────────────────────────────────────────────────────────────────────
  const normalizeTaskResponse = (data) => {
    if (data?.results && Array.isArray(data.results)) return data.results;
    if (Array.isArray(data)) return data;
    return [];
  };

  const mergeTaskLists = (primary = [], secondary = []) => {
    const map = new Map();
    [...primary, ...secondary].forEach(t => { if (!map.has(t.id)) map.set(t.id, t); });
    return Array.from(map.values());
  };

  const organizeTasks = (tasksList, cols) => {
    if (!tasksList || !Array.isArray(tasksList)) {
      const empty = {};
      cols.forEach(c => { empty[c.id] = []; });
      setTasks(empty);
      return;
    }

    const organized = {};
    cols.forEach(c => { organized[c.id] = []; });

    tasksList.forEach(task => {
      const item = {
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: task.priority_display || getPriorityText(task.priority),
        assignee: task.assignee_name || 'Не назначен',
        dueDate: task.due_date,
        estimatedHours: task.estimated_hours,
        status: task.status,
        kanban_column: task.kanban_column,
        creator: task.creator_name,
        createdAt: task.created_at,
      };

      // Place by kanban_column first, then fall back to status_key match
      if (task.kanban_column) {
        const colId = task.kanban_column;
        if (organized[colId] !== undefined) {
          organized[colId].push(item);
          return;
        }
      }
      // Fall back: find column whose status_key matches
      const fallbackCol = cols.find(c => c.status_key === task.status);
      if (fallbackCol) {
        organized[fallbackCol.id].push(item);
      } else if (cols.length > 0) {
        organized[cols[0].id].push(item);
      }
    });

    setTasks(organized);
  };

  const loadTasks = async (scope = taskScope, cols = columns) => {
    try {
      let tasksList = [];
      if (scope === 'mine') {
        const [assignedData, createdData] = await Promise.all([
          taskService.getMyTasks(),
          taskService.getCreatedByMe(),
        ]);
        tasksList = mergeTaskLists(normalizeTaskResponse(assignedData), normalizeTaskResponse(createdData));
      } else {
        const data = await taskService.getTasks();
        tasksList = normalizeTaskResponse(data);
      }
      organizeTasks(tasksList, cols);
      return tasksList;
    } catch (err) {
      console.error('Ошибка загрузки задач:', err);
      const empty = {};
      cols.forEach(c => { empty[c.id] = []; });
      setTasks(empty);
      throw err;
    }
  };

  const loadStats = async () => {
    try {
      const data = await taskService.getStats();
      setStats({
        total: data.total || 0,
        inProgress: data.by_status?.in_progress || 0,
        onReview: data.by_status?.review || 0,
        completed: data.by_status?.done || 0,
      });
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    }
  };

  const computeStatsFromTasks = (tasksList) => {
    const counts = { total: tasksList.length, inProgress: 0, onReview: 0, completed: 0 };
    tasksList.forEach(t => {
      if (t.status === 'in_progress') counts.inProgress++;
      if (t.status === 'review') counts.onReview++;
      if (t.status === 'done') counts.completed++;
    });
    setStats(counts);
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const cols = await loadColumns();
      const tasksList = await loadTasks(taskScope, cols);
      if (taskScope === 'all') await loadStats();
      else computeStatsFromTasks(tasksList);
    } catch (err) {
      setError('Не удалось загрузить данные. Проверьте подключение к серверу.');
    } finally {
      setLoading(false);
    }
  };

  const handleScopeChange = async (scope) => {
    if (scope === taskScope) return;
    setTaskScope(scope);
    setLoading(true);
    setError(null);
    try {
      const tasksList = await loadTasks(scope, columns);
      if (scope === 'all') await loadStats();
      else computeStatsFromTasks(tasksList);
    } catch {
      setError('Не удалось загрузить задачи. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  const onDragStart = (e, task, sourceColId) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('sourceColumn', sourceColId);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  };

  const onDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    document.querySelectorAll('.kanban-column').forEach(el => el.classList.remove('drag-over'));
  };

  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onDragEnter = (e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); };
  const onDragLeave = (e) => { e.currentTarget.classList.remove('drag-over'); };

  const onDrop = async (e, targetColId) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const taskId = e.dataTransfer.getData('taskId');
    const sourceColId = e.dataTransfer.getData('sourceColumn');
    if (!taskId || sourceColId === targetColId) return;

    const taskToMove = tasks[sourceColId]?.find(t => t.id === taskId);
    if (!taskToMove) return;

    const targetCol = columns.find(c => c.id === targetColId);

    const updated = { ...tasks };
    updated[sourceColId] = updated[sourceColId].filter(t => t.id !== taskId);
    updated[targetColId] = [...(updated[targetColId] || []), { ...taskToMove, kanban_column: targetColId }];
    setTasks(updated);

    setIsUpdating(true);
    try {
      await taskService.updateTaskStatus(taskId, targetCol?.status_key || taskToMove.status, targetColId);
      await loadStats();
    } catch {
      await loadTasks(taskScope, columns);
      alert('Не удалось переместить задачу. Попробуйте еще раз.');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Company management helpers ───────────────────────────────────────────────
  const loadCustomRoles = async () => {
    if (!activeCompany?.id) return;
    try {
      const roles = await companyAPI.getRoles(activeCompany.id);
      setAvailableCustomRoles(roles.filter(r => !r.is_system));
    } catch { /* ignore */ }
  };

  const safeExtractArray = (response) => {
    const data = response?.data || response;
    if (Array.isArray(data)) return data;
    if (data?.results && Array.isArray(data.results)) return data.results;
    if (typeof data === 'object' && data !== null) {
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key]) && data[key].length > 0) return data[key];
      }
    }
    return [];
  };

  const loadCompanyMembers = async () => {
    if (!activeCompany?.id) return;
    try {
      const membersResponse = await companyAPI.getMembers(activeCompany.id);
      const membersList = safeExtractArray(membersResponse);
      const membersWithRoles = await Promise.all(
        membersList.map(async (member) => {
          try {
            const rolesResponse = await companyAPI.getMemberRoles(activeCompany.id, member.user);
            const roles = safeExtractArray(rolesResponse);
            return { ...member, roles: roles.map(r => r.role || r) };
          } catch {
            return { ...member, roles: [] };
          }
        })
      );
      setCompanyMembers(membersWithRoles);
      try {
        const invitedResponse = await companyAPI.getInvitedMembers(activeCompany.id);
        setInvitedMembers(safeExtractArray(invitedResponse));
      } catch {
        setInvitedMembers([]);
      }
    } catch {
      setCompanyMembers([]);
      setInvitedMembers([]);
    }
  };

  const handleAssignRoleToMember = async (userId, roleId) => {
    try {
      await companyAPI.assignRoleToMember(activeCompany.id, userId, roleId);
      await loadCompanyMembers();
    } catch { alert('Не удалось назначить роль'); }
  };

  const handleRemoveRoleFromMember = async (userId, roleId) => {
    if (!confirm('Снять эту роль с участника?')) return;
    try {
      await companyAPI.removeRoleFromMember(activeCompany.id, userId, roleId);
      await loadCompanyMembers();
    } catch { alert('Не удалось снять роль'); }
  };

  const handleDeleteCompany = async () => {
    if (!activeCompany) return;
    setDeleteCompanyError('');
    const result = await deleteCompany(activeCompany.id);
    if (result.success) {
      setShowDeleteCompanyModal(false);
      navigate('/dashboard');
    } else {
      setDeleteCompanyError(result.error);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) { setInviteError('Введите email'); return; }
    if (!selectedInviteCompanyId) { setInviteError('Компания не выбрана'); return; }
    try {
      const { inviteMember } = useCompanyStore.getState();
      const result = await inviteMember(selectedInviteCompanyId, { email: inviteEmail, role: inviteRole });
      if (result.success) {
        setIsInviteModalOpen(false);
        setInviteEmail('');
        setInviteRole('member');
        setInviteError('');
        if (selectedInviteCompanyId === activeCompany?.id) await loadCompanyMembers();
      } else {
        setInviteError(result.error || 'Ошибка приглашения');
      }
    } catch (err) {
      setInviteError('Ошибка: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleChangeMemberRole = async (userId, newRole) => {
    if (!activeCompany?.id) return;
    try {
      await companyAPI.changeMemberRole(activeCompany.id, userId, newRole);
      await loadCompanyMembers();
    } catch { alert('Не удалось изменить роль'); }
  };

  const handleRemoveMember = async (userId) => {
    if (!activeCompany?.id || !confirm('Удалить участника?')) return;
    try {
      await companyAPI.removeMember(activeCompany.id, userId);
      await loadCompanyMembers();
    } catch { alert('Не удалось удалить участника'); }
  };

  const handleTaskClick = async (task) => {
    try {
      const fullTask = await taskService.getTask(task.id);
      setSelectedTask(fullTask);
    } catch {
      setSelectedTask(task);
    }
    setIsTaskModalOpen(true);
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Удалить задачу? Это действие нельзя отменить.')) return;
    setIsUpdating(true);
    try {
      await taskService.deleteTask(taskId);
      await loadAllData();
      setIsTaskModalOpen(false);
      setSelectedTask(null);
    } catch { alert('Не удалось удалить задачу.'); }
    finally { setIsUpdating(false); }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getPriorityText = (p) =>
    ({ low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критический' }[p] || 'Средний');

  const getPriorityColor = (p) =>
    ({ Критический: 'priority-critical', Высокий: 'priority-high', Средний: 'priority-medium', Низкий: 'priority-low' }[p] || 'priority-medium');

  const formatTimeLeft = (dueDate, estimatedHours) => {
    if (!dueDate && !estimatedHours) return '—';
    if (dueDate) {
      const diff = new Date(dueDate) - new Date();
      if (diff <= 0) return 'Просрочено';
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      if (days > 0) return `${days}д ${hours}ч`;
      if (hours > 0) return `${hours}ч`;
      return 'Менее часа';
    }
    const days = Math.floor(estimatedHours / 24);
    const hours = estimatedHours % 24;
    return days > 0 ? `${days}д ${hours}ч` : `${hours}ч`;
  };

  const allTasksList = columns.flatMap(c => tasks[c.id] || []);

  // ── Sidebar JSX (inline, NOT a nested component) ────────────────────────────
  const sidebarJSX = (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo">ControlFlow</h1>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-section">
          <CompanySwitcher />
        </div>

        {activeCompany && (
          <div className="sidebar-nav-section">
            <ProjectSwitcher
              companyId={activeCompany.id}
              currentUserRole={currentUserRole}
            />
          </div>
        )}

        {activeCompany && (
          <div className="sidebar-nav-section sidebar-nav-filters">
            <a
              href="#"
              className={`nav-item ${taskScope === 'all' ? 'active' : ''}`}
              onClick={e => { e.preventDefault(); handleScopeChange('all'); }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 2h5v5H2V2zm9 0h5v5h-5V2zM2 11h5v5H2v-5zm9 0h5v5h-5v-5z" fill="currentColor"/>
              </svg>
              <span>Все задачи</span>
            </a>
            <a
              href="#"
              className={`nav-item ${taskScope === 'mine' ? 'active' : ''}`}
              onClick={e => { e.preventDefault(); handleScopeChange('mine'); }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M2 17v-1.5A4.5 4.5 0 016.5 11h5A4.5 4.5 0 0116 15.5V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>Мои задачи</span>
            </a>
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info-sidebar">
          <div className="user-avatar">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="user-details-sidebar">
            <div className="user-name">{user?.full_name || user?.email}</div>
            <div className="user-role">{user?.role || 'Пользователь'}</div>
          </div>
        </div>
        <button onClick={async () => { await logout(); navigate('/login'); }} className="logout-btn">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7 1H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M13 13l4-4-4-4M17 9H7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  );

  // ── Single return (no nested component definitions) ──────────────────────────
  return (
    <div className="dashboard">
      {sidebarJSX}

      <main className="main-content">
        {!activeCompany ? (
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <h2>Выберите или создайте компанию</h2>
            <p>Для начала работы создайте компанию или примите приглашение</p>
          </div>
        ) : loading ? (
          <div className="loading-container">
            <div className="spinner-large"></div>
            <p>Загрузка...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h3>Ошибка загрузки</h3>
            <p>{error}</p>
            <button className="btn-primary" onClick={loadAllData}>Повторить</button>
          </div>
        ) : (<>

        <header className="main-header">
          <div className="header-title">
            <h2>
              {activeCompany?.name}
              {activeProject && <span className="header-project-badge"> / {activeProject.name}</span>}
              {' — '}
              {taskScope === 'all' ? 'Дашборд' : 'Мои задачи'}
            </h2>
            <p>Управление задачами и проектами</p>
          </div>
          <div className="header-actions">
            <button className="theme-toggle-btn" onClick={toggleTheme} title="Сменить тему">
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
          <button className={`tab-btn ${activeView === 'kanban' ? 'active' : ''}`} onClick={() => setActiveView('kanban')}>
            Канбан
          </button>
          <button className={`tab-btn ${activeView === 'list' ? 'active' : ''}`} onClick={() => setActiveView('list')}>
            Список
          </button>
          <button className={`tab-btn ${activeView === 'company' ? 'active' : ''}`} onClick={() => setActiveView('company')}>
            Компания
          </button>
        </div>

        {/* ── Kanban ── */}
        {activeView === 'kanban' && (
          <div className="kanban-wrapper">
            {canManageColumns && (
              <div className="kanban-toolbar">
                <button
                  className="btn-secondary btn-small"
                  onClick={() => { setEditingColumn(null); setColumnForm({ name: '', color: '#6B7280' }); setShowColumnModal(true); }}
                >
                  + Добавить колонку
                </button>
              </div>
            )}

            <div className="kanban-board">
              {columns.map(col => (
                <div
                  key={col.id}
                  className="kanban-column"
                  onDragOver={onDragOver}
                  onDragEnter={onDragEnter}
                  onDragLeave={onDragLeave}
                  onDrop={e => onDrop(e, col.id)}
                >
                  <div className="column-header">
                    <div className="column-header-left">
                      <span className="column-color-dot" style={{ background: col.color }} />
                      <h3>{col.name}</h3>
                      <span className="task-count">{(tasks[col.id] || []).length}</span>
                    </div>
                    {canManageColumns && (
                      <div className="column-header-actions">
                        <button
                          className="column-action-btn"
                          title="Редактировать"
                          onClick={() => {
                            setEditingColumn(col);
                            setColumnForm({ name: col.name, color: col.color });
                            setShowColumnModal(true);
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          className="column-action-btn"
                          title="Удалить"
                          onClick={() => handleDeleteColumn(col)}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="column-tasks">
                    {(tasks[col.id] || []).map(task => (
                      <div
                        key={task.id}
                        className={`task-card ${col.status_key === 'done' ? 'completed' : ''}`}
                        draggable={!isUpdating}
                        onDragStart={e => onDragStart(e, task, col.id)}
                        onDragEnd={onDragEnd}
                        onClick={() => handleTaskClick(task)}
                      >
                        <div className="task-header">
                          <h4>{task.title}</h4>
                          <span className={`priority-badge ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </div>
                        {task.description && <p className="task-description">{task.description}</p>}
                        <div className="task-footer">
                          <div className="task-assignee">
                            <div className="assignee-avatar">
                              {task.assignee?.[0] || '?'}
                            </div>
                            <span>{task.assignee}</span>
                          </div>
                          <div className="task-time">
                            <span>{formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(tasks[col.id] || []).length === 0 && (
                      <div className="empty-column"><p>Нет задач</p></div>
                    )}
                  </div>
                </div>
              ))}

              {columns.length === 0 && (
                <div className="empty-state">
                  <p>Нет колонок. Создайте первую колонку.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── List view ── */}
        {activeView === 'list' && (
          <div className="list-view">
            {allTasksList.map(task => (
              <div key={task.id} className="list-item" onClick={() => handleTaskClick(task)}>
                <div className="list-item-content">
                  <div className="list-item-title">
                    <h4>{task.title}</h4>
                    <span className={`priority-badge ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                  </div>
                  <p className="list-item-desc">{task.description}</p>
                  <div className="list-item-meta">
                    <span>👤 {task.assignee}</span>
                    <span>⏱ {formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                  </div>
                </div>
              </div>
            ))}
            {allTasksList.length === 0 && (
              <div className="empty-state"><p>Нет задач. Создайте первую задачу!</p></div>
            )}
          </div>
        )}

        {/* ── Company view ── */}
        {activeView === 'company' && (
          <div className="company-management">
            <div className="company-header">
              <h2>Управление компанией</h2>
              <div className="company-header-actions">
                {companies.length > 0 && (
                  <>
                    <button className="btn-secondary" onClick={() => setShowRolesPanel(true)}>Роли</button>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setSelectedInviteCompanyId(activeCompany?.id || companies[0]?.id || '');
                        setIsInviteModalOpen(true);
                      }}
                    >
                      + Пригласить участника
                    </button>
                    {activeCompany && (
                      <button className="btn-danger" onClick={() => setShowDeleteCompanyModal(true)}>
                        Удалить компанию
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="company-info">
              <div className="info-card">
                <h3>{activeCompany?.name || 'Компания не выбрана'}</h3>
                <p>{activeCompany?.description || ''}</p>
                {activeCompany && (
                  <div className="company-stats">
                    <span>👥 {companyMembers.length} участников</span>
                    <span>📨 {invitedMembers.length} приглашений</span>
                  </div>
                )}
              </div>
            </div>

            <div className="members-section">
              <h3>Активные участники</h3>
              <div className="members-list">
                {companyMembers.map(member => (
                  <div key={member.id} className="member-item">
                    <div className="member-info">
                      <div className="member-avatar">
                        {member.user_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="member-details">
                        <h4>{member.user_name || member.user_email}</h4>
                        <p>{member.user_email}</p>
                        <div className="member-roles-container">
                          {member.roles && member.roles.length > 0 ? (
                            member.roles.map(role => (
                              <span key={role.id} className="member-role-badge">
                                {role.name}
                                {currentUserRole === 'owner' && role.name !== 'owner' && (
                                  <button className="remove-role-badge" onClick={() => handleRemoveRoleFromMember(member.user, role.id)}>×</button>
                                )}
                              </span>
                            ))
                          ) : (
                            <span className="member-role-badge member-role-default">
                              {member.role === 'owner' ? '👑 Владелец' : member.role === 'admin' ? '⚙️ Администратор' : '👤 Участник'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="member-actions">
                      <MemberActionsMenu
                        member={member}
                        currentUserRole={currentUserRole}
                        availableCustomRoles={availableCustomRoles}
                        onChangeRole={handleChangeMemberRole}
                        onAssignCustomRole={handleAssignRoleToMember}
                        onRemoveCustomRole={handleRemoveRoleFromMember}
                        onRemoveMember={handleRemoveMember}
                      />
                    </div>
                  </div>
                ))}
                {companyMembers.length === 0 && (
                  <div className="empty-state"><p>Нет активных участников</p></div>
                )}
              </div>
            </div>

            {invitedMembers.length > 0 && (
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
        </>
        )}
      </main>

      {/* ── Modals ── */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setSelectedTask(null); }}
        onTaskCreated={async () => { await loadAllData(); setIsTaskModalOpen(false); setSelectedTask(null); }}
        onTaskDelete={handleDeleteTask}
        task={selectedTask}
        mode={selectedTask ? 'view' : 'create'}
      />

      {/* Invite modal */}
      {isInviteModalOpen && (
        <div className="modal-overlay" onClick={() => setIsInviteModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Пригласить участника</h3>
              <button className="modal-close" onClick={() => setIsInviteModalOpen(false)}>×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleInviteMember(); }}>
              {companies.length > 1 && (
                <div className="form-group">
                  <label>Компания *</label>
                  <select value={selectedInviteCompanyId} onChange={e => setSelectedInviteCompanyId(e.target.value)} required>
                    <option value="" disabled>Выберите компанию</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Email участника *</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@example.com" required autoFocus />
              </div>
              <div className="form-group">
                <label>Роль</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="member">Участник</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              {inviteError && <div className="error-message">{inviteError}</div>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsInviteModalOpen(false)}>Отмена</button>
                <button type="submit" className="btn-primary">Отправить приглашение</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roles panel */}
      {showRolesPanel && activeCompany && (
        <RolesPanel
          companyId={activeCompany.id}
          members={companyMembers}
          currentUserRole={currentUserRole}
          onClose={() => setShowRolesPanel(false)}
          onRolesUpdated={async () => { await loadCompanyMembers(); await loadCustomRoles(); }}
        />
      )}

      {/* Delete company modal */}
      {showDeleteCompanyModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteCompanyModal(false)}>
          <div className="modal-content modal-delete" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Удалить компанию?</h3>
              <button className="modal-close" onClick={() => setShowDeleteCompanyModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Вы собираетесь удалить <strong>{activeCompany?.name}</strong>.</p>
              <p>Это действие нельзя отменить.</p>
              {deleteCompanyError && <div className="error-message">{deleteCompanyError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteCompanyModal(false)}>Отмена</button>
              <button className="btn-danger" onClick={handleDeleteCompany}>Удалить компанию</button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban column modal */}
      {showColumnModal && (
        <div className="modal-overlay" onClick={() => setShowColumnModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingColumn ? 'Редактировать колонку' : 'Новая колонка'}</h3>
              <button className="modal-close" onClick={() => setShowColumnModal(false)}>×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleSaveColumn(); }}>
              <div className="form-group">
                <label>Название *</label>
                <input
                  type="text"
                  value={columnForm.name}
                  onChange={e => setColumnForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Название колонки"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Цвет</label>
                <div className="color-picker-row">
                  <input
                    type="color"
                    value={columnForm.color}
                    onChange={e => setColumnForm(f => ({ ...f, color: e.target.value }))}
                    className="color-picker"
                  />
                  <span className="color-picker-value">{columnForm.color}</span>
                </div>
              </div>
              {columnError && <div className="error-message">{columnError}</div>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowColumnModal(false)}>Отмена</button>
                <button type="submit" className="btn-primary">{editingColumn ? 'Сохранить' : 'Создать'}</button>
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
