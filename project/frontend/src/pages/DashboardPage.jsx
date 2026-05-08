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
import ProfileModal from '../components/ProfileModal';
import AnalyticsView from '../components/AnalyticsView';
import ReportsView from '../components/ReportsView';
import HomeView from '../components/HomeView';
import ChatView from '../components/ChatView';
import GanttView from '../components/GanttView';
import AIGenerateModal from '../components/AIGenerateModal';
import NotificationBell from '../components/NotificationBell';
import OnboardingTutorial from '../components/OnboardingTutorial';
import Toast from '../components/Toast';
import GlobalSearch from '../components/GlobalSearch';
import KanbanSkeleton from '../components/KanbanSkeleton';
import { taskService } from '../api/taskService';
import companyAPI from '../api/companyService';
import kanbanService from '../api/kanbanService';
import chatService from '../api/chatService';

const InviteCards = () => {
  const { invites, respondToInvite, fetchCompanies, setActiveCompany } = useCompanyStore();
  if (!invites.length) return null;

  const handleAccept = async (companyId) => {
    const result = await respondToInvite(companyId, 'accept');
    if (result?.success) {
      const companies = await fetchCompanies();
      const accepted = (companies || []).find(c => c.id === companyId);
      if (accepted) setActiveCompany(accepted);
    }
  };

  const handleDecline = (companyId) => respondToInvite(companyId, 'decline');

  return (
    <div style={{ marginTop: '24px', width: '100%', maxWidth: '480px' }}>
      <p style={{ fontWeight: 600, marginBottom: '12px', fontSize: '15px' }}>
        📨 У вас {invites.length === 1 ? 'есть приглашение' : `есть приглашения (${invites.length})`}
      </p>
      {invites.map(invite => (
        <div key={invite.id} style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>
              {invite.company_name || invite.company?.name}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Роль: {invite.role_display || invite.role}
              {invite.invited_by_name && ` · Пригласил: ${invite.invited_by_name}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button className="btn-primary btn-small" onClick={() => handleAccept(invite.company)}>
              Принять
            </button>
            <button className="btn-secondary btn-small" onClick={() => handleDecline(invite.company)}>
              Отклонить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const DashboardPage = () => {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { activeCompany, companies, deleteCompany } = useCompanyStore();
  const { activeProject } = useProjectStore();
  const navigate = useNavigate();

  const [showTutorial, setShowTutorial] = useState(() => {
    if (!user?.id) return false;
    return !localStorage.getItem(`tutorial_done_${user.id}`);
  });

  const [activeView, setActiveView] = useState(() => localStorage.getItem('activeView') || 'home');
  const changeView = (view) => { setActiveView(view); localStorage.setItem('activeView', view); };

  // Collapsible sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === '1'
  );
  const toggleSidebar = () => setSidebarCollapsed(v => {
    const next = !v;
    localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
    return next;
  });

  // Drag-to-scroll on kanban board
  const kanbanBoardRef = useRef(null);
  const dragScrollRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const onKanbanMouseDown = (e) => {
    if (e.target.closest('.kanban-column')) return;
    dragScrollRef.current = { active: true, startX: e.pageX, scrollLeft: kanbanBoardRef.current.scrollLeft };
    kanbanBoardRef.current.style.cursor = 'grabbing';
    kanbanBoardRef.current.style.userSelect = 'none';
  };
  const onKanbanMouseMove = (e) => {
    if (!dragScrollRef.current.active) return;
    e.preventDefault();
    const dx = e.pageX - dragScrollRef.current.startX;
    kanbanBoardRef.current.scrollLeft = dragScrollRef.current.scrollLeft - dx;
  };
  const onKanbanMouseUp = () => {
    if (!dragScrollRef.current.active) return;
    dragScrollRef.current.active = false;
    kanbanBoardRef.current.style.cursor = '';
    kanbanBoardRef.current.style.userSelect = '';
  };

  // Global search
  const [showSearch, setShowSearch] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(s => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Persistent project stats cache: { [projectName]: { total, done } }
  // Accumulates across project switches so sidebar always shows counts
  const [projectStats, setProjectStats] = useState({});
  const updateProjectStats = (tasksList) => {
    const counts = {};
    tasksList.forEach(t => {
      const name = t.projectName || t.project_name || '';
      if (!name) return;
      if (!counts[name]) counts[name] = { total: 0, done: 0 };
      counts[name].total++;
      if (t.status === 'done') counts[name].done++;
    });
    if (Object.keys(counts).length > 0) {
      setProjectStats(prev => ({ ...prev, ...counts }));
    }
  };

  // Toast notifications
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const [taskScope, setTaskScope] = useState('all');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasks, setTasks] = useState({});
  const [columns, setColumns] = useState([]);
  const [kanbanColWidth, setKanbanColWidth] = useState(320);
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
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
  const [dragColId, setDragColId] = useState(null);
  const isDraggingColRef = useRef(false);

  // Custom role picker per member
  const [openRolePickerFor, setOpenRolePickerFor] = useState(null);

  // List view
  const [listSearch,  setListSearch]  = useState('');
  const [listSort,    setListSort]    = useState('dueDate');
  const [listSortDir, setListSortDir] = useState('asc');

  // Profile modal
  const [showProfileModal, setShowProfileModal] = useState(false);

  // AI generate tasks modal
  const [showAIGenerate, setShowAIGenerate] = useState(false);

  // Chat notifications
  const [chatUnread, setChatUnread] = useState(0);
  const [chatToast,  setChatToast]  = useState(null);
  const chatLastIdsRef = useRef({});

  const currentUserRole =
    companyMembers.find(m => m.user === user?.id)?.role ||
    (activeCompany?.owner === user?.id ? 'owner' : 'member');
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

  // Reset chat tracking when company or user changes
  useEffect(() => {
    chatLastIdsRef.current = {};
  }, [activeCompany?.id, user?.id]);

  // ── Chat background notifications ───────────────────────────────────────────
  useEffect(() => {
    if (activeView === 'chat') {
      setChatUnread(0);
      setChatToast(null);
      return;
    }
    if (!activeCompany) return;

    let alive = true;
    let intervalId = null;
    const lastIds = chatLastIdsRef.current; // persists across view-switch re-runs

    // Returns the latest new message from others in a channel, or null
    const checkChannel = async (params) => {
      const key = params.with_user ? `dm:${params.with_user}` : 'company';
      try {
        const data = await chatService.getMessages(params);
        const msgs = Array.isArray(data) ? data : (data?.results ?? []);
        if (!msgs.length) return null;

        const latestId = Number(msgs[msgs.length - 1].id);

        if (lastIds[key] == null) {
          lastIds[key] = latestId; // set baseline, don't notify
          return null;
        }
        if (latestId <= lastIds[key]) return null;

        const myId = user?.id;
        const fresh = msgs.filter(m => Number(m.id) > lastIds[key] && m.sender !== myId);
        lastIds[key] = latestId;
        return fresh.length ? fresh[fresh.length - 1] : null;
      } catch { return null; }
    };

    chatService.getMembers().then(async ms => {
      if (!alive) return;
      const members = Array.isArray(ms) ? ms : [];

      const channels = [
        { type: 'company' },
        ...members.map(m => ({ type: 'direct', with_user: m.id })),
      ];

      // First pass: set baselines for all channels
      await Promise.all(channels.map(p => checkChannel(p)));
      if (!alive) return;

      const poll = async () => {
        if (!alive) return;
        const hits = (await Promise.all(channels.map(p => checkChannel(p)))).filter(Boolean);
        if (hits.length && alive) {
          setChatUnread(n => n + hits.length);
          const last = hits[hits.length - 1];
          setChatToast({ sender: last.sender_name, text: last.text });
        }
      };

      intervalId = setInterval(poll, 8000);
    }).catch(() => {});

    return () => { alive = false; clearInterval(intervalId); };
  }, [activeCompany?.id, activeView, user?.id]);

  useEffect(() => {
    if (!chatToast) return;
    const t = setTimeout(() => setChatToast(null), 5000);
    return () => clearTimeout(t);
  }, [chatToast]);

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
        showToast(`Колонка «${columnForm.name}» обновлена`);
      } else {
        await kanbanService.createColumn(columnForm);
        showToast(`Колонка «${columnForm.name}» создана`);
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
    showToast(`Колонка «${col.name}» удалена`, 'error');
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
        projectName: task.project_name || task.project_display || '',
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
      updateProjectStats(tasksList);
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
  const [draggingTaskId, setDraggingTaskId] = useState(null);

  const onDragStart = (e, task, sourceColId) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('sourceColumn', sourceColId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTaskId(task.id);
    // Delay opacity so the ghost snapshot is taken first
    requestAnimationFrame(() => {
      e.currentTarget.style.opacity = '0.4';
      e.currentTarget.style.transform = 'scale(0.97)';
    });
  };

  const onDragEnd = (e) => {
    e.currentTarget.style.opacity = '';
    e.currentTarget.style.transform = '';
    setDraggingTaskId(null);
    document.querySelectorAll('.kanban-column').forEach(el => {
      el.classList.remove('drag-over');
      el.classList.remove('col-drag-over');
    });
  };

  const onColDragStart = (e, col) => {
    e.stopPropagation();
    isDraggingColRef.current = true;
    setDragColId(col.id);
    e.dataTransfer.setData('colId', col.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onColDragEnd = () => {
    isDraggingColRef.current = false;
    setDragColId(null);
    document.querySelectorAll('.kanban-column').forEach(el => el.classList.remove('col-drag-over'));
  };

  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onDragEnter = (e) => {
    e.preventDefault();
    if (isDraggingColRef.current) e.currentTarget.classList.add('col-drag-over');
    else e.currentTarget.classList.add('drag-over');
  };
  const onDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    e.currentTarget.classList.remove('drag-over');
    e.currentTarget.classList.remove('col-drag-over');
  };

  const onDrop = async (e, targetColId) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    e.currentTarget.classList.remove('col-drag-over');

    const sourceColId = e.dataTransfer.getData('colId');
    if (sourceColId) {
      isDraggingColRef.current = false;
      setDragColId(null);
      if (sourceColId === targetColId) return;
      const fromIdx = columns.findIndex(c => c.id === sourceColId);
      const toIdx = columns.findIndex(c => c.id === targetColId);
      const reordered = [...columns];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      const withOrder = reordered.map((c, i) => ({ ...c, order: i }));
      setColumns(withOrder);
      try {
        await kanbanService.reorderColumns(withOrder.map(c => ({ id: c.id, order: c.order })));
      } catch {
        loadColumns();
      }
      return;
    }

    const taskId = e.dataTransfer.getData('taskId');
    const taskSourceColId = e.dataTransfer.getData('sourceColumn');
    if (!taskId || taskSourceColId === targetColId) return;

    const taskToMove = tasks[taskSourceColId]?.find(t => t.id === taskId);
    if (!taskToMove) return;

    const targetCol = columns.find(c => c.id === targetColId);

    const updated = { ...tasks };
    updated[taskSourceColId] = updated[taskSourceColId].filter(t => t.id !== taskId);
    updated[targetColId] = [...(updated[targetColId] || []), { ...taskToMove, kanban_column: targetColId }];
    setTasks(updated);

    setIsUpdating(true);
    try {
      await taskService.updateTaskStatus(taskId, targetCol?.status_key || taskToMove.status, targetColId);
      await loadStats();
      showToast(`«${taskToMove.title}» → ${targetCol?.name || 'колонка'}`);
    } catch {
      await loadTasks(taskScope, columns);
      showToast('Не удалось переместить задачу', 'error');
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
            return { ...member, roles: roles.map(r => ({ id: r.role, name: r.role_name })) };
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
      showToast('Задача удалена', 'error');
    } catch { showToast('Не удалось удалить задачу', 'error'); }
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

  const getDeadlineBadge = (task) => {
    if (!task.dueDate || task.status === 'done' || task.status === 'cancelled') return null;
    const now = new Date();
    const due = new Date(task.dueDate);
    const diffMs = due - now;
    if (diffMs < 0) return { label: 'Просрочено', cls: 'deadline-badge--overdue' };
    const diffDays = diffMs / 86400000;
    if (diffDays <= 2) {
      const hours = Math.floor(diffMs / 3600000);
      const label = hours < 24 ? `${hours}ч` : `${Math.ceil(diffDays)}д`;
      return { label, cls: 'deadline-badge--soon' };
    }
    return null;
  };

  const PRIORITY_STRIP = {
    Критический: '#EF4444',
    Высокий:     '#F59E0B',
    Средний:     '#3B82F6',
    Низкий:      '#6B7280',
  };

  // ── Icon nav items ───────────────────────────────────────────────────────────
  const NAV_ITEMS = [
    {
      view: 'home', label: 'Главная',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>,
    },
    {
      view: 'kanban', label: 'Канбан',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/></svg>,
    },
    {
      view: 'list', label: 'Список',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>,
    },
    {
      view: 'analytics', label: 'Аналитика',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    },
    {
      view: 'reports', label: 'Отчёты',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    },
    {
      view: 'company', label: 'Компания',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 21v-4h6v4"/></svg>,
    },
    {
      view: 'gantt', label: 'Диаграмма Ганта',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="8" height="3" rx="1"/><rect x="7" y="10" width="10" height="3" rx="1"/><rect x="5" y="15" width="12" height="3" rx="1"/><line x1="3" y1="3" x2="3" y2="21" strokeWidth="1.2"/></svg>,
    },
    {
      view: 'chat', label: 'Чат',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    },
  ];

  // ── Sidebar JSX (inline, NOT a nested component) ────────────────────────────
  const sidebarJSX = (
    <aside className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#6366f1"/>
            <rect x="7" y="9"    width="18" height="3.5" rx="1.75" fill="white"/>
            <rect x="7" y="14.5" width="13" height="3.5" rx="1.75" fill="white" fillOpacity="0.7"/>
            <rect x="7" y="20"   width="8"  height="3.5" rx="1.75" fill="white" fillOpacity="0.4"/>
          </svg>
          {!sidebarCollapsed && <span>Поток</span>}
        </div>
        {!sidebarCollapsed && (
          <button className="sidebar-collapse-btn" onClick={toggleSidebar} title="Свернуть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        {sidebarCollapsed && (
          <button className="sidebar-expand-btn" onClick={toggleSidebar} title="Развернуть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
        {!sidebarCollapsed && (
          <div className="sidebar-nav-section">
            <CompanySwitcher />
          </div>
        )}

        {activeCompany && !sidebarCollapsed && (
          <div className="sidebar-nav-section">
            <ProjectSwitcher
              companyId={activeCompany.id}
              currentUserRole={currentUserRole}
              projectStats={projectStats}
            />
          </div>
        )}

        {activeCompany && !sidebarCollapsed && (
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

        {activeCompany && (
          <div className="sidebar-nav-section sidebar-nav-views">
            {!sidebarCollapsed && <div className="sidebar-nav-label">Разделы</div>}
            {NAV_ITEMS.map(({ view, label, icon }) => (
              <button
                key={view}
                className={`nav-item nav-item--btn${activeView === view ? ' active' : ''}${sidebarCollapsed ? ' nav-item--icon-only' : ''}`}
                onClick={() => changeView(view)}
                title={sidebarCollapsed ? label : undefined}
              >
                {icon}
                {!sidebarCollapsed && <span style={{ flex: 1 }}>{label}</span>}
                {!sidebarCollapsed && view === 'chat' && chatUnread > 0 && (
                  <span className="chat-unread-badge">{chatUnread > 99 ? '99+' : chatUnread}</span>
                )}
                {sidebarCollapsed && view === 'chat' && chatUnread > 0 && (
                  <span className="chat-unread-dot" />
                )}
              </button>
            ))}
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <button className="user-info-sidebar" onClick={() => setShowProfileModal(true)} title={sidebarCollapsed ? (user?.full_name || user?.email) : 'Редактировать профиль'}>
          <div className="user-avatar">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          {!sidebarCollapsed && (
            <div className="user-details-sidebar">
              <div className="user-name">{user?.full_name || user?.email}</div>
              <div className="user-role">{user?.role || 'Пользователь'}</div>
            </div>
          )}
        </button>
        {!sidebarCollapsed && (
          <button onClick={async () => { await logout(); navigate('/login'); }} className="logout-btn">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M7 1H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M13 13l4-4-4-4M17 9H7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
            <span>Выйти</span>
          </button>
        )}
      </div>
    </aside>
  );

  // ── Single return (no nested component definitions) ──────────────────────────
  return (
    <div className={`dashboard${sidebarCollapsed ? ' dashboard--sidebar-collapsed' : ''}`}>
      {sidebarJSX}

      <main className="main-content">
        {!activeCompany ? (
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <h2>Выберите или создайте компанию</h2>
            <p>Для начала работы создайте компанию или примите приглашение</p>
            <InviteCards />
          </div>
        ) : loading ? (
          <div className="loading-container">
            <KanbanSkeleton columns={4} cardsPerCol={3} />
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
          <div className="header-breadcrumb">
            <span className="header-company">{activeCompany?.name}</span>
            {activeProject && <><span className="header-sep">›</span><span className="header-project">{activeProject.name}</span></>}
            <span className="header-sep">›</span>
            <span className="header-view-name">
              {NAV_ITEMS.find(n => n.view === activeView)?.label || activeView}
            </span>
          </div>
          <div className="header-actions">
            <button className="search-trigger-btn" onClick={() => setShowSearch(true)} title="Поиск (Ctrl+K)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span className="search-trigger-label">Поиск</span>
              <kbd className="search-trigger-kbd">Ctrl+K</kbd>
            </button>
            <NotificationBell />
            <button className="theme-toggle-btn" onClick={toggleTheme} title="Сменить тему">
              {theme === 'light' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              )}
            </button>
            {activeCompany && (
              <button className="btn-ai-gen" onClick={() => setShowAIGenerate(true)} title="Сгенерировать задачи с помощью ИИ">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Задачи с ИИ
              </button>
            )}
            <button className="btn-new-task" onClick={() => setIsTaskModalOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Новая задача
            </button>
          </div>
        </header>

        {/* ── Home ── */}
        {activeView === 'home' && (
          <HomeView
            stats={stats}
            allTasks={allTasksList}
            user={user}
            onTaskClick={handleTaskClick}
            activeCompany={activeCompany}
          />
        )}

        {/* ── Kanban ── */}
        {activeView === 'kanban' && (
          <div className="kanban-wrapper">
            <div className="kanban-toolbar">
              {canManageColumns && (
                <button
                  className="btn-secondary btn-small"
                  onClick={() => { setEditingColumn(null); setColumnForm({ name: '', color: '#6B7280' }); setShowColumnModal(true); }}
                >
                  + Добавить колонку
                </button>
              )}
              <div className="kanban-zoom-controls">
                <button
                  className="kanban-zoom-btn"
                  onClick={() => setKanbanColWidth(w => Math.max(180, w - 40))}
                  title="Уменьшить колонки"
                  disabled={kanbanColWidth <= 200}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
                  </svg>
                </button>
                <span className="kanban-zoom-label">{Math.round((kanbanColWidth / 320) * 100)}%</span>
                <button
                  className="kanban-zoom-btn"
                  onClick={() => setKanbanColWidth(w => Math.min(520, w + 40))}
                  title="Увеличить колонки"
                  disabled={kanbanColWidth >= 520}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                  </svg>
                </button>
                {kanbanColWidth !== 320 && (
                  <button
                    className="kanban-zoom-btn kanban-zoom-reset"
                    onClick={() => setKanbanColWidth(320)}
                    title="Сбросить масштаб"
                  >
                    100%
                  </button>
                )}
              </div>
            </div>

            {isUpdating && columns.length === 0 && <KanbanSkeleton columns={4} cardsPerCol={3} />}

            <div
              className="kanban-board"
              ref={kanbanBoardRef}
              onMouseDown={onKanbanMouseDown}
              onMouseMove={onKanbanMouseMove}
              onMouseUp={onKanbanMouseUp}
              onMouseLeave={onKanbanMouseUp}
            >
              {columns.map(col => (
                <div
                  key={col.id}
                  className={`kanban-column${dragColId === col.id ? ' col-dragging' : ''}`}
                  style={{ flex: `0 0 ${kanbanColWidth}px`, width: kanbanColWidth }}
                  onDragOver={onDragOver}
                  onDragEnter={onDragEnter}
                  onDragLeave={onDragLeave}
                  onDrop={e => onDrop(e, col.id)}
                >
                  <div className="column-header">
                    {canManageColumns && (
                      <span
                        className="column-drag-handle"
                        draggable
                        onDragStart={e => onColDragStart(e, col)}
                        onDragEnd={onColDragEnd}
                        title="Перетащить колонку"
                      >
                        <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                          <circle cx="3" cy="3" r="1.5" fill="currentColor"/>
                          <circle cx="3" cy="8" r="1.5" fill="currentColor"/>
                          <circle cx="3" cy="13" r="1.5" fill="currentColor"/>
                          <circle cx="8" cy="3" r="1.5" fill="currentColor"/>
                          <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                          <circle cx="8" cy="13" r="1.5" fill="currentColor"/>
                        </svg>
                      </span>
                    )}
                    <div className="column-header-left">
                      <span className="column-color-dot" style={{ background: col.color }} />
                      <h3>{col.name}</h3>
                      <span
                        className="task-count"
                        style={{ background: `${col.color}22`, color: col.color }}
                      >
                        {(tasks[col.id] || []).length}
                      </span>
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
                        className={`task-card ${col.status_key === 'done' ? 'completed' : ''}${draggingTaskId === task.id ? ' task-card--dragging' : ''}`}
                        style={{ borderLeft: `3px solid ${PRIORITY_STRIP[task.priority] || '#6B7280'}` }}
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
                          {(() => {
                            const badge = getDeadlineBadge(task);
                            if (badge) return (
                              <span className={`deadline-badge ${badge.cls}`}>{badge.label}</span>
                            );
                            if (task.dueDate || task.estimatedHours) return (
                              <div className="task-time">
                                <span>{formatTimeLeft(task.dueDate, task.estimatedHours)}</span>
                              </div>
                            );
                            return null;
                          })()}
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
                  {canManageColumns && (
                    <button
                      className="btn-primary"
                      style={{ marginTop: 12 }}
                      onClick={() => { setEditingColumn(null); setColumnForm({ name: '', color: '#6B7280' }); setShowColumnModal(true); }}
                    >
                      + Добавить колонку
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── List view ── */}
        {activeView === 'list' && (() => {
          const STATUS_LABEL = { new:'Новая', in_progress:'В работе', review:'На проверке', done:'Завершена', cancelled:'Отменена' };
          const STATUS_COLOR = { new:'#6B7280', in_progress:'#3B82F6', review:'#F59E0B', done:'#10B981', cancelled:'#EF4444' };
          const PRIO_COLOR   = { Критический:'#EF4444', Высокий:'#F59E0B', Средний:'#3B82F6', Низкий:'#6B7280' };
          const now = new Date();

          const toggleSort = (col) => {
            if (listSort === col) setListSortDir(d => d === 'asc' ? 'desc' : 'asc');
            else { setListSort(col); setListSortDir('asc'); }
          };
          const SortIcon = ({ col }) => {
            if (listSort !== col) return <span className="lv-sort-icon">⇅</span>;
            return <span className="lv-sort-icon active">{listSortDir === 'asc' ? '↑' : '↓'}</span>;
          };

          const q = listSearch.toLowerCase();
          const filtered = allTasksList
            .filter(t =>
              !q ||
              t.title?.toLowerCase().includes(q) ||
              t.assignee?.toLowerCase().includes(q) ||
              t.description?.toLowerCase().includes(q)
            )
            .sort((a, b) => {
              let av, bv;
              if (listSort === 'dueDate') {
                av = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                bv = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
              } else if (listSort === 'priority') {
                const order = { Критический:0, Высокий:1, Средний:2, Низкий:3 };
                av = order[a.priority] ?? 4; bv = order[b.priority] ?? 4;
              } else if (listSort === 'status') {
                const order = { in_progress:0, review:1, new:2, done:3, cancelled:4 };
                av = order[a.status] ?? 5; bv = order[b.status] ?? 5;
              } else {
                av = (a[listSort] || '').toString().toLowerCase();
                bv = (b[listSort] || '').toString().toLowerCase();
              }
              if (av < bv) return listSortDir === 'asc' ? -1 : 1;
              if (av > bv) return listSortDir === 'asc' ? 1 : -1;
              return 0;
            });

          return (
            <div className="lv-wrap">
              {/* toolbar */}
              <div className="lv-toolbar">
                <div className="lv-search-wrap">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    className="lv-search"
                    placeholder="Поиск по названию, исполнителю…"
                    value={listSearch}
                    onChange={e => setListSearch(e.target.value)}
                  />
                  {listSearch && <button className="lv-search-clear" onClick={() => setListSearch('')}>✕</button>}
                </div>
                <span className="lv-count">{filtered.length} задач</span>
              </div>

              {/* table */}
              <div className="lv-table-wrap">
                <table className="lv-table">
                  <thead>
                    <tr>
                      <th className="lv-th-task" onClick={() => toggleSort('title')}>Задача <SortIcon col="title"/></th>
                      <th onClick={() => toggleSort('status')}>Статус <SortIcon col="status"/></th>
                      <th onClick={() => toggleSort('priority')}>Приоритет <SortIcon col="priority"/></th>
                      <th>Проект</th>
                      <th onClick={() => toggleSort('assignee')}>Исполнитель <SortIcon col="assignee"/></th>
                      <th onClick={() => toggleSort('dueDate')}>Дедлайн <SortIcon col="dueDate"/></th>
                      <th>Оценка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(task => {
                      const overdue = task.dueDate && new Date(task.dueDate) < now && task.status !== 'done' && task.status !== 'cancelled';
                      const prioColor = PRIO_COLOR[task.priority] || '#6B7280';
                      const statusColor = STATUS_COLOR[task.status] || '#6B7280';
                      return (
                        <tr
                          key={task.id}
                          className={`lv-row${overdue ? ' lv-row--overdue' : ''}`}
                          onClick={() => handleTaskClick(task)}
                          style={{ borderLeft: `3px solid ${prioColor}` }}
                        >
                          <td className="lv-td-task">
                            {overdue && <span className="lv-overdue-dot" title="Просрочено"/>}
                            <div>
                              <div className="lv-task-title">{task.title}</div>
                              {task.description && <div className="lv-task-desc">{task.description}</div>}
                            </div>
                          </td>
                          <td>
                            <span className="lv-badge" style={{ background: statusColor + '22', color: statusColor }}>
                              {STATUS_LABEL[task.status] || task.status}
                            </span>
                          </td>
                          <td>
                            <span className="lv-badge" style={{ background: prioColor + '22', color: prioColor }}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="lv-td-muted">{task.projectName || '—'}</td>
                          <td>
                            {task.assignee && task.assignee !== 'Не назначен' ? (
                              <div className="lv-assignee">
                                <div className="lv-avatar">{task.assignee[0]}</div>
                                <span>{task.assignee}</span>
                              </div>
                            ) : <span className="lv-td-muted">—</span>}
                          </td>
                          <td className={overdue ? 'lv-td-overdue' : 'lv-td-muted'}>
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString('ru-RU', { day:'numeric', month:'short', year:'numeric' })
                              : '—'}
                          </td>
                          <td className="lv-td-muted">
                            {task.estimatedHours ? `${task.estimatedHours} ч` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="lv-empty">
                    {listSearch ? `Ничего не найдено по «${listSearch}»` : 'Нет задач'}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
                {companyMembers.map(member => {
                  const unassigned = availableCustomRoles.filter(r => !member.roles?.some(mr => mr.id === r.id));
                  const canEdit = currentUserRole === 'owner' && member.role !== 'owner';
                  return (
                    <div key={member.id} className="member-item">
                      <div className="member-info" style={{ flex: 'none', minWidth: 180 }}>
                        <div className="member-avatar">
                          {member.user_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="member-details">
                          <h4>{member.user_name || member.user_email}</h4>
                          <p>{member.user_email}</p>
                          <span className="member-base-role-badge" data-role={member.role}>
                            {{ owner: 'Владелец', admin: 'Администратор', member: 'Участник' }[member.role] || member.role}
                          </span>
                        </div>
                      </div>

                      <div className="member-custom-roles">
                        {member.roles?.map(role => (
                          <span key={role.id} className="member-role-chip">
                            {role.name}
                            {canEdit && (
                              <button onClick={() => handleRemoveRoleFromMember(member.user, role.id)} title="Снять роль">×</button>
                            )}
                          </span>
                        ))}
                        {canEdit && unassigned.length > 0 && (
                          <div style={{ position: 'relative' }}>
                            <button
                              className="btn-add-role"
                              onClick={() => setOpenRolePickerFor(openRolePickerFor === member.user ? null : member.user)}
                            >
                              + Роль
                            </button>
                            {openRolePickerFor === member.user && (
                              <div className="role-picker-dropdown">
                                {unassigned.map(role => (
                                  <button key={role.id} onClick={() => { handleAssignRoleToMember(member.user, role.id); setOpenRolePickerFor(null); }}>
                                    {role.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="member-actions">
                        <MemberActionsMenu
                          member={member}
                          currentUserRole={currentUserRole}
                          onChangeRole={handleChangeMemberRole}
                          onRemoveMember={handleRemoveMember}
                        />
                      </div>
                    </div>
                  );
                })}
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

        {/* ── Analytics ── */}
        {activeView === 'analytics' && <AnalyticsView />}

        {/* ── Reports ── */}
        {activeView === 'reports' && <ReportsView />}

        {/* ── Gantt ── */}
        {activeView === 'gantt' && (
          <GanttView allTasks={allTasksList} onTaskClick={handleTaskClick} />
        )}

        {/* ── Chat ── */}
        {activeView === 'chat' && <ChatView />}
        </>
        )}
      </main>

      {/* ── Modals ── */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setSelectedTask(null); }}
        onTaskCreated={async (task) => { await loadAllData(); setIsTaskModalOpen(false); setSelectedTask(null); showToast(task?.title ? `Задача «${task.title}» создана` : 'Задача создана'); }}
        onTaskUpdated={async () => { await loadAllData(); }}
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
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Email или имя участника *</label>
                <input
                  type="text"
                  value={inviteEmail}
                  onChange={async e => {
                    const val = e.target.value;
                    setInviteEmail(val);
                    if (val.length >= 2) {
                      try {
                        const res = await companyAPI.searchUsers(val);
                        setUserSuggestions(res.data || []);
                        setShowSuggestions(true);
                      } catch { setUserSuggestions([]); }
                    } else {
                      setUserSuggestions([]);
                      setShowSuggestions(false);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => userSuggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Введите email или имя..."
                  required
                  autoFocus
                  autoComplete="off"
                />
                {showSuggestions && userSuggestions.length > 0 && (
                  <ul className="invite-suggestions">
                    {userSuggestions.map(u => (
                      <li key={u.id} onMouseDown={() => {
                        setInviteEmail(u.email);
                        setShowSuggestions(false);
                        setUserSuggestions([]);
                      }}>
                        <span className="invite-suggestion-name">{u.full_name}</span>
                        <span className="invite-suggestion-email">{u.email}</span>
                      </li>
                    ))}
                  </ul>
                )}
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

      {/* AI Generate modal */}
      {showAIGenerate && (
        <AIGenerateModal
          projectId={activeProject?.id || null}
          projectName={activeProject?.name || activeCompany?.name || ''}
          onClose={() => setShowAIGenerate(false)}
          onTasksCreated={loadAllData}
        />
      )}

      {isUpdating && (
        <div className="updating-overlay">
          <div className="updating-spinner"></div>
        </div>
      )}

      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} onProfileUpdated={loadAllData} />
      )}

      {/* Chat toast notification */}
      {chatToast && (
        <div
          className="chat-toast"
          onClick={() => { changeView('chat'); setChatToast(null); setChatUnread(0); }}
        >
          <div className="chat-toast-header">
            <svg className="chat-toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="chat-toast-sender">{chatToast.sender}</span>
            <button
              className="chat-toast-close"
              onClick={e => { e.stopPropagation(); setChatToast(null); }}
            >✕</button>
          </div>
          <div className="chat-toast-text">{chatToast.text}</div>
        </div>
      )}

      {showTutorial && (
        <OnboardingTutorial
          userId={user?.id}
          onDone={() => setShowTutorial(false)}
        />
      )}

      {showSearch && (
        <GlobalSearch
          allTasksList={allTasksList}
          onNavigate={changeView}
          onTaskClick={(task) => { handleTaskClick(task); }}
          onClose={() => setShowSearch(false)}
        />
      )}

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default DashboardPage;
