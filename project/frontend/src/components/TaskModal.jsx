import { useState, useEffect, useRef } from 'react';
import { taskService } from '../api/taskService';
import companyAPI from '../api/companyService';
import useAuthStore from '../store/authStore';
import useProjectStore from '../store/projectStore';

// ── helpers ──────────────────────────────────────────────────────────────────
const PRIORITY_COLOR = { low: '#6B7280', medium: '#3B82F6', high: '#F59E0B', critical: '#EF4444' };
const PRIORITY_LABEL = { low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критический' };
const STATUS_COLOR   = { new: '#6B7280', in_progress: '#3B82F6', review: '#F59E0B', done: '#10B981', cancelled: '#EF4444' };
const STATUS_LABEL   = { new: 'Новая', in_progress: 'В работе', review: 'На проверке', done: 'Завершена', cancelled: 'Отменена' };

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtCommentTime(iso) {
  const d = new Date(iso), now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)    return 'только что';
  if (diff < 3600)  return `${Math.floor(diff / 60)} мин. назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function padZ(n) { return String(n).padStart(2, '0'); }
function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  return `${padZ(Math.floor(s / 3600))}:${padZ(Math.floor((s % 3600) / 60))}:${padZ(s % 60)}`;
}

// ── TaskModal ─────────────────────────────────────────────────────────────────
const TaskModal = ({ isOpen, onClose, onTaskCreated, onTaskUpdated, onTaskDelete, onTimerChange, task, mode = 'create' }) => {
  const { user } = useAuthStore();
  const { activeProject } = useProjectStore();

  const [formData, setFormData] = useState({
    title: '', description: '', assignee_id: '',
    priority: 'medium', status: 'new', due_date: '', estimated_hours: '',
  });
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const [isEditing,    setIsEditing]    = useState(false);
  const [editSnapshot, setEditSnapshot] = useState(null);

  const [comments,       setComments]       = useState([]);
  const [commentText,    setCommentText]    = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const commentListRef = useRef(null);
  const commentInputRef = useRef(null);

  // @mention dropdown
  const [mentionQuery,   setMentionQuery]   = useState('');
  const [mentionVisible, setMentionVisible] = useState(false);
  const [mentionIdx,     setMentionIdx]     = useState(0);
  const mentionStartRef = useRef(-1);

  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart,   setTimerStart]   = useState(null);
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');
  const [actualHours,  setActualHours]  = useState(null);
  const timerRef = useRef(null);

  const [subtasks,       setSubtasks]       = useState([]);
  const [newSubtask,     setNewSubtask]     = useState('');
  const [subtaskLoading, setSubtaskLoading] = useState(false);

  // ── effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    loadCompanyMembers();
    if (mode === 'view' && task) {
      setFormData({
        title:           task.title || '',
        description:     task.description || '',
        assignee_id:     task.assignee?.id || task.assignee_id || task.assignee || '',
        priority:        task.priority || 'medium',
        status:          task.status || 'new',
        due_date:        task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '',
        estimated_hours: task.estimated_hours || '',
      });
      setActualHours(task.actual_hours ?? null);
      setIsEditing(false);
      loadComments(task.id);
      loadSubtasks(task.id);
      checkTimer(task.id);
    } else if (mode === 'create') {
      resetForm();
      setComments([]);
      setSubtasks([]);
    }
  }, [isOpen, mode, task]);

  useEffect(() => {
    if (commentListRef.current) commentListRef.current.scrollTop = commentListRef.current.scrollHeight;
  }, [comments]);

  useEffect(() => {
    if (timerRunning && timerStart) {
      timerRef.current = setInterval(() => setTimerDisplay(fmtElapsed(Date.now() - timerStart)), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning, timerStart]);

  useEffect(() => { if (!isOpen) clearInterval(timerRef.current); }, [isOpen]);

  // ── loaders ────────────────────────────────────────────────────────────────
  const loadCompanyMembers = async () => {
    try {
      const s = localStorage.getItem('company-storage');
      if (!s) { await loadAllUsers(); return; }
      const companyId = JSON.parse(s)?.state?.activeCompany?.id;
      if (!companyId) { await loadAllUsers(); return; }
      const response = await companyAPI.getMembers(companyId);
      let data = response?.data || response;
      if (data?.results) data = data.results;
      setUsers(Array.isArray(data) ? data.map(m => ({
        id: m.user, full_name: m.user_name || m.user_email || 'Неизвестный', email: m.user_email || '',
      })) : []);
    } catch { await loadAllUsers(); }
  };

  const loadAllUsers = async () => {
    try {
      const data = await taskService.getUsers();
      setUsers(Array.isArray(data) ? data : data?.results || data?.data || []);
    } catch { setUsers([]); }
  };

  const loadComments = async (taskId) => {
    try { setComments(await taskService.getComments(taskId) || []); }
    catch { setComments([]); }
  };

  const loadSubtasks = async (taskId) => {
    try {
      const data = await taskService.getSubtasks(taskId);
      setSubtasks(Array.isArray(data) ? data : []);
    } catch { setSubtasks([]); }
  };

  const checkTimer = async (taskId) => {
    try {
      const data = await taskService.getActiveTimer(taskId);
      if (data.running && data.started_at) {
        const startMs = new Date(data.started_at).getTime();
        setTimerStart(startMs); setTimerRunning(true);
        setTimerDisplay(fmtElapsed(Date.now() - startMs));
        onTimerChange?.({ id: taskId, title: task.title, startedAt: startMs });
      } else {
        setTimerRunning(false); setTimerStart(null); setTimerDisplay('00:00:00');
        onTimerChange?.(null);
      }
    } catch { setTimerRunning(false); }
  };

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleChange = (e) => { setFormData(p => ({ ...p, [e.target.name]: e.target.value })); setError(''); };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!formData.title.trim()) { setError('Название задачи обязательно'); return; }
    setLoading(true);
    try {
      const newTask = await taskService.createTask({
        title:           formData.title,
        description:     formData.description || '',
        priority:        formData.priority,
        status:          formData.status,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        due_date:        formData.due_date ? new Date(formData.due_date).toISOString() : null,
        assignee:        formData.assignee_id || null,
        project:         activeProject?.id || null,
      });
      if (onTaskCreated) onTaskCreated(newTask);
      onClose(); resetForm();
    } catch (err) { setError(err.message || 'Ошибка создания задачи'); }
    finally { setLoading(false); }
  };

  const handleDelete  = () => { if (onTaskDelete && task) onTaskDelete(task.id); };
  const startEdit     = () => { setEditSnapshot({ ...formData }); setIsEditing(true); setError(''); };
  const cancelEdit    = () => { setFormData(editSnapshot); setIsEditing(false); setError(''); };

  const saveEdit = async () => {
    if (!formData.title.trim()) { setError('Название задачи обязательно'); return; }
    setLoading(true);
    try {
      const updated = await taskService.partialUpdateTask(task.id, {
        title:           formData.title,
        description:     formData.description || '',
        assignee:        formData.assignee_id || null,
        priority:        formData.priority,
        status:          formData.status,
        due_date:        formData.due_date ? new Date(formData.due_date).toISOString() : null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      });
      setIsEditing(false);
      if (onTaskUpdated) onTaskUpdated(updated);
    } catch (err) { setError(err.message || 'Ошибка сохранения'); }
    finally { setLoading(false); }
  };

  const handleStartTimer = async () => {
    try {
      const data = await taskService.startTimer(task.id);
      if (data.started_at) {
        const startMs = new Date(data.started_at).getTime();
        setTimerStart(startMs); setTimerRunning(true);
        onTimerChange?.({ id: task.id, title: task.title, startedAt: startMs });
      }
    } catch (err) {
      console.error('Timer start failed:', err);
    }
  };

  const handleStopTimer = async () => {
    clearInterval(timerRef.current);
    try {
      const data = await taskService.stopTimer(task.id);
      setTimerRunning(false); setTimerStart(null); setTimerDisplay('00:00:00');
      if (data.actual_hours !== undefined) setActualHours(data.actual_hours);
      onTimerChange?.(null);
    } catch (err) {
      console.error('Timer stop failed:', err);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || commentLoading) return;
    setCommentLoading(true);
    setMentionVisible(false);
    const textToSend = commentText.trim();
    setCommentText('');
    try {
      await taskService.addComment(task.id, textToSend);
      await loadComments(task.id);
    } catch {
      setCommentText(textToSend);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteComment = async (id) => {
    try { await taskService.deleteComment(task.id, id); setComments(p => p.filter(c => c.id !== id)); } catch {}
  };

  const otherUsers = users.filter(u => String(u.id) !== String(user?.id));
  const mentionSuggestions = mentionQuery
    ? otherUsers.filter(u => u.full_name?.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : otherUsers.slice(0, 6);

  const insertMention = (user) => {
    const before = commentText.slice(0, mentionStartRef.current);
    const after  = commentText.slice(mentionStartRef.current + 1 + mentionQuery.length);
    const inserted = `@${user.full_name} `;
    setCommentText(before + inserted + after);
    setMentionVisible(false);
    setMentionQuery('');
    commentInputRef.current?.focus();
  };

  const onCommentChange = (e) => {
    const val = e.target.value;
    setCommentText(val);
    const pos = e.target.selectionStart;
    // Find last @ before cursor
    const before = val.slice(0, pos);
    const atIdx = before.lastIndexOf('@');
    if (atIdx !== -1 && !before.slice(atIdx + 1).includes(' ') && pos - atIdx <= 30) {
      mentionStartRef.current = atIdx;
      setMentionQuery(before.slice(atIdx + 1));
      setMentionVisible(true);
      setMentionIdx(0);
    } else {
      setMentionVisible(false);
      setMentionQuery('');
    }
  };

  const onCommentKey = (e) => {
    if (mentionVisible) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => (i + 1) % mentionSuggestions.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(i => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (mentionSuggestions[mentionIdx]) { e.preventDefault(); insertMention(mentionSuggestions[mentionIdx]); return; }
      }
      if (e.key === 'Escape') { setMentionVisible(false); return; }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAddComment(); }
  };

  // Render comment text with highlighted @mentions
  // Matches against known user names (longest first to avoid partial matches)
  const renderCommentText = (text) => {
    if (!text) return text ?? '';
    const names = users.map(u => u.full_name).filter(Boolean).sort((a, b) => b.length - a.length);
    const parts = [];
    let i = 0, buf = '';
    while (i < text.length) {
      if (text[i] === '@') {
        const matched = names.find(name => text.startsWith(name, i + 1));
        if (matched) {
          if (buf) { parts.push(buf); buf = ''; }
          parts.push(<mark key={i} className="comment-mention">@{matched}</mark>);
          i += 1 + matched.length;
        } else {
          buf += '@'; i++;
        }
      } else {
        buf += text[i++];
      }
    }
    if (buf) parts.push(buf);
    return parts.length > 0 ? parts : text;
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || subtaskLoading) return;
    setSubtaskLoading(true);
    try {
      const s = await taskService.createSubtask(task.id, { title: newSubtask.trim(), priority: 'medium', status: 'new' });
      setSubtasks(p => [...p, s]); setNewSubtask('');
    } catch {} finally { setSubtaskLoading(false); }
  };

  const handleToggleSubtask = async (subtask) => {
    const next = subtask.status === 'done' ? 'new' : 'done';
    try {
      await taskService.updateSubtaskStatus(subtask.id, next);
      setSubtasks(p => p.map(s => s.id === subtask.id ? { ...s, status: next } : s));
    } catch {}
  };

  const onSubtaskKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } };

  const resetForm = () => {
    setFormData({ title: '', description: '', assignee_id: '', priority: 'medium', status: 'new', due_date: '', estimated_hours: '' });
    setError(''); setCommentText(''); setIsEditing(false);
    setTimerRunning(false); setTimerDisplay('00:00:00'); setActualHours(null);
  };

  if (!isOpen) return null;

  const pColor         = PRIORITY_COLOR[formData.priority] || '#6B7280';
  const sColor         = STATUS_COLOR[formData.status]   || '#6B7280';
  const fieldsDisabled = mode === 'view' && !isEditing;
  const doneCount      = subtasks.filter(s => s.status === 'done').length;
  const subtaskPct     = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

  // ── shared form fields ─────────────────────────────────────────────────────
  const formFields = (
    <>
      {mode === 'create' && (
        <div className="form-group">
          <label>Название задачи *</label>
          <input type="text" name="title" value={formData.title} onChange={handleChange}
            placeholder="Введите название задачи" autoFocus />
        </div>
      )}

      <div className="form-group">
        <label>Описание</label>
        <textarea name="description" value={formData.description} onChange={handleChange}
          rows={mode === 'view' ? 3 : 4} placeholder="Описание задачи…" disabled={fieldsDisabled} />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Приоритет</label>
          <select name="priority" value={formData.priority} onChange={handleChange} disabled={fieldsDisabled}>
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
            <option value="critical">Критический</option>
          </select>
        </div>
        <div className="form-group">
          <label>Статус</label>
          <select name="status" value={formData.status} onChange={handleChange} disabled={fieldsDisabled}>
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
        <select name="assignee_id" value={formData.assignee_id} onChange={handleChange} disabled={fieldsDisabled}>
          <option value="">Не назначен</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
        </select>
      </div>

      {mode === 'view' && task && (
        <div className="form-row">
          <div className="form-group">
            <label>Создатель</label>
            <input type="text" value={task.creator?.full_name || task.creator_name || '—'} readOnly />
          </div>
          <div className="form-group">
            <label>Создана</label>
            <input type="text" value={fmtDate(task.created_at)} readOnly />
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label>Дедлайн</label>
          <input type="datetime-local" name="due_date" value={formData.due_date} onChange={handleChange} disabled={fieldsDisabled} />
        </div>
        <div className="form-group">
          <label>Оценка (часы)</label>
          <input type="number" name="estimated_hours" value={formData.estimated_hours} onChange={handleChange}
            step="0.5" min="0" placeholder="напр. 4.5" disabled={fieldsDisabled} />
        </div>
      </div>
    </>
  );

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`tm-modal${mode === 'view' ? ' tm-modal--view' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="tm-hd">
          <div className="tm-hd-left">
            {mode === 'view' && !isEditing && (
              <>
                <span className="tm-badge" style={{ background: sColor + '22', color: sColor }}>
                  {STATUS_LABEL[formData.status] || formData.status}
                </span>
                <span className="tm-badge" style={{ background: pColor + '22', color: pColor }}>
                  {PRIORITY_LABEL[formData.priority] || formData.priority}
                </span>
              </>
            )}
            {mode === 'view' && isEditing ? (
              <input className="tm-title-input" name="title" value={formData.title}
                onChange={handleChange} placeholder="Название задачи" autoFocus />
            ) : (
              <h3 className="tm-title">{mode === 'view' ? (task?.title || 'Задача') : 'Новая задача'}</h3>
            )}
          </div>
          <div className="tm-hd-right">
            {mode === 'view' && !isEditing && (
              <button className="btn-edit" onClick={startEdit}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Редактировать
              </button>
            )}
            <button className="tm-close" onClick={onClose}>×</button>
          </div>
        </div>

        {/* Timer bar (view only) */}
        {mode === 'view' && task && (
          <div className="tm-timer-bar">
            <div className="tm-timer-left">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className={`tm-timer-display${timerRunning ? ' tm-timer-display--running' : ''}`}>{timerDisplay}</span>
              {actualHours != null && Number(actualHours) > 0 && (
                <span className="tm-timer-logged">Итого: {parseFloat(actualHours).toFixed(2)} ч.</span>
              )}
            </div>
            {timerRunning ? (
              <button className="tm-timer-btn tm-timer-btn--stop" onClick={handleStopTimer}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                Стоп
              </button>
            ) : (
              <button className="tm-timer-btn tm-timer-btn--start" onClick={handleStartTimer}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Начать
              </button>
            )}
          </div>
        )}

        {/* ── CREATE mode: simple scrollable body ── */}
        {mode === 'create' && (
          <div className="tm-body tm-body--create">
            {formFields}
          </div>
        )}

        {/* ── VIEW mode: two-column body ── */}
        {mode === 'view' && (
          <div className="tm-body tm-body--split">
            {/* Left: form + subtasks */}
            <div className="tm-form-col">
              {formFields}

              <div className="tm-subtasks">
                <div className="tm-subtasks-header">
                  <span className="tm-subtasks-title">Подзадачи</span>
                  {subtasks.length > 0 && <span className="tm-subtasks-count">{doneCount}/{subtasks.length}</span>}
                </div>
                {subtasks.length > 0 && (
                  <div className="tm-subtasks-progress">
                    <div className="tm-subtasks-bar"><div className="tm-subtasks-fill" style={{ width: `${subtaskPct}%` }} /></div>
                    <span className="tm-subtasks-pct">{subtaskPct}%</span>
                  </div>
                )}
                <div className="tm-subtask-list">
                  {subtasks.map(s => (
                    <div key={s.id} className={`tm-subtask-item${s.status === 'done' ? ' tm-subtask-item--done' : ''}`}>
                      <input type="checkbox" checked={s.status === 'done'} onChange={() => handleToggleSubtask(s)} className="tm-subtask-check" />
                      <span className="tm-subtask-name">{s.title}</span>
                    </div>
                  ))}
                </div>
                <div className="tm-subtask-add">
                  <input type="text" className="tm-subtask-input" placeholder="Добавить подзадачу… (Enter)"
                    value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={onSubtaskKey} />
                  <button className="tm-subtask-btn" onClick={handleAddSubtask} disabled={!newSubtask.trim() || subtaskLoading}>
                    {subtaskLoading ? '…' : '+'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: comments */}
            <div className="tm-comments-col">
              <div className="tm-comments-header">
                <span className="tm-comments-title">Комментарии</span>
                <span className="tm-comments-count">{comments.length}</span>
              </div>
              <div className="tm-comment-list" ref={commentListRef}>
                {comments.length === 0 ? (
                  <div className="tm-comments-empty">Нет комментариев. Напишите первым!</div>
                ) : (
                  comments.map(c => {
                    const isOwn = c.author_id === user?.id || String(c.author_id) === String(user?.id);
                    return (
                      <div key={c.id} className={`tm-comment${isOwn ? ' tm-comment--own' : ''}`}>
                        <div className="tm-comment-avatar">{c.author_initials}</div>
                        <div className="tm-comment-body">
                          <div className="tm-comment-meta">
                            <span className="tm-comment-author">{c.author_name}</span>
                            <span className="tm-comment-time">{fmtCommentTime(c.created_at)}</span>
                            {isOwn && (
                              <button className="tm-comment-del" onClick={() => handleDeleteComment(c.id)} title="Удалить">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                  <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className="tm-comment-text">{renderCommentText(c.text)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="tm-comment-input-wrap" style={{ position: 'relative' }}>
                {mentionVisible && mentionSuggestions.length > 0 && (
                  <div className="mention-dropdown">
                    {mentionSuggestions.map((u, i) => (
                      <button
                        key={u.id}
                        className={`mention-item${i === mentionIdx ? ' mention-item--active' : ''}`}
                        onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                      >
                        <span className="mention-avatar">{u.full_name?.[0]}</span>
                        <span>{u.full_name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  ref={commentInputRef}
                  className="tm-comment-input"
                  placeholder="Написать комментарий… Используйте @ для упоминания (Ctrl+Enter)"
                  value={commentText}
                  onChange={onCommentChange}
                  onKeyDown={onCommentKey}
                  rows={2}
                />
                <button className="tm-comment-send" onClick={handleAddComment}
                  disabled={!commentText.trim() || commentLoading} title="Отправить (Ctrl+Enter)">
                  {commentLoading ? <span className="tm-comment-spinner" /> : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="tm-footer">
          {error && <span className="tm-footer-error">{error}</span>}
          <div className="tm-footer-actions">
            {mode === 'view' && isEditing ? (
              <>
                <button className="btn-secondary" onClick={cancelEdit}>Отмена</button>
                <button className="btn-primary" onClick={saveEdit} disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Сохранить'}
                </button>
              </>
            ) : mode === 'view' ? (
              <>
                {onTaskDelete && <button className="btn-danger" onClick={handleDelete}>Удалить</button>}
                <button className="btn-secondary" onClick={onClose}>Закрыть</button>
              </>
            ) : (
              <>
                <button className="btn-secondary" onClick={onClose}>Отмена</button>
                <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Создать задачу'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
