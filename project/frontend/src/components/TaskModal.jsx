import { useState, useEffect, useRef } from 'react';
import { taskService } from '../api/taskService';
import companyAPI from '../api/companyService';
import useAuthStore from '../store/authStore';

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
  const d   = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)    return 'только что';
  if (diff < 3600)  return `${Math.floor(diff / 60)} мин. назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// ── TaskModal ─────────────────────────────────────────────────────────────────
const TaskModal = ({ isOpen, onClose, onTaskCreated, onTaskDelete, task, mode = 'create' }) => {
  const { user } = useAuthStore();

  const [formData, setFormData] = useState({
    title: '', description: '', assignee_id: '',
    priority: 'medium', status: 'new', due_date: '', estimated_hours: '',
  });
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // comments state
  const [comments,       setComments]       = useState([]);
  const [commentText,    setCommentText]    = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const commentListRef = useRef(null);

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
      loadComments(task.id);
    } else if (mode === 'create') {
      resetForm();
      setComments([]);
    }
  }, [isOpen, mode, task]);

  // scroll comments to bottom when list updates
  useEffect(() => {
    if (commentListRef.current) {
      commentListRef.current.scrollTop = commentListRef.current.scrollHeight;
    }
  }, [comments]);

  // ── loaders ────────────────────────────────────────────────────────────────
  const loadCompanyMembers = async () => {
    try {
      const companyStorage = localStorage.getItem('company-storage');
      if (!companyStorage) { await loadAllUsers(); return; }
      const companyId = JSON.parse(companyStorage)?.state?.activeCompany?.id;
      if (!companyId) { await loadAllUsers(); return; }

      const response = await companyAPI.getMembers(companyId);
      let membersData = response?.data || response;
      if (membersData?.results) membersData = membersData.results;
      if (Array.isArray(membersData)) {
        setUsers(membersData.map(m => ({
          id: m.user,
          full_name: m.user_name || m.user_email || 'Неизвестный',
          email: m.user_email || '',
        })));
      } else {
        setUsers([]);
      }
    } catch {
      await loadAllUsers();
    }
  };

  const loadAllUsers = async () => {
    try {
      const data = await taskService.getUsers();
      const list = Array.isArray(data) ? data : data?.results || data?.data || [];
      setUsers(list);
    } catch {
      setUsers([]);
    }
  };

  const loadComments = async (taskId) => {
    try {
      const data = await taskService.getComments(taskId);
      setComments(Array.isArray(data) ? data : []);
    } catch {
      setComments([]);
    }
  };

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { setError('Название задачи обязательно'); return; }
    setLoading(true);
    try {
      const due = formData.due_date ? new Date(formData.due_date).toISOString() : null;
      const newTask = await taskService.createTask({
        title:           formData.title,
        description:     formData.description || '',
        priority:        formData.priority,
        status:          formData.status,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        due_date:        due,
        assignee:        formData.assignee_id || null,
      });
      if (onTaskCreated) onTaskCreated(newTask);
      onClose();
      resetForm();
    } catch (err) {
      setError(err.message || 'Ошибка создания задачи');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => { if (onTaskDelete && task) onTaskDelete(task.id); };

  const handleAddComment = async () => {
    if (!commentText.trim() || commentLoading) return;
    setCommentLoading(true);
    try {
      const created = await taskService.addComment(task.id, commentText.trim());
      setComments(prev => [...prev, created]);
      setCommentText('');
    } catch {
      // silent
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await taskService.deleteComment(task.id, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {
      // silent
    }
  };

  const onCommentKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAddComment(); }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', assignee_id: '', priority: 'medium', status: 'new', due_date: '', estimated_hours: '' });
    setError('');
    setCommentText('');
  };

  if (!isOpen) return null;

  const pColor = PRIORITY_COLOR[formData.priority] || '#6B7280';
  const sColor = STATUS_COLOR[formData.status]   || '#6B7280';

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content tm-modal${mode === 'view' ? ' tm-modal--view' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="modal-header">
          <div className="tm-header-left">
            {mode === 'view' && (
              <>
                <span className="tm-badge" style={{ background: sColor + '22', color: sColor }}>
                  {STATUS_LABEL[formData.status] || formData.status}
                </span>
                <span className="tm-badge" style={{ background: pColor + '22', color: pColor }}>
                  {PRIORITY_LABEL[formData.priority] || formData.priority}
                </span>
              </>
            )}
            <h3 className="tm-title">
              {mode === 'view' ? (task?.title || 'Задача') : 'Новая задача'}
            </h3>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* ── Two-column layout in view mode ── */}
        <div className={`tm-body${mode === 'view' ? ' tm-body--split' : ''}`}>

          {/* ── Left: task form ── */}
          <div className="tm-form-col">
            <form onSubmit={handleSubmit}>

              {mode === 'create' && (
                <div className="form-group">
                  <label>Название задачи *</label>
                  <input
                    type="text" name="title" value={formData.title}
                    onChange={handleChange} placeholder="Введите название задачи" autoFocus
                  />
                </div>
              )}

              <div className="form-group">
                <label>Описание</label>
                <textarea
                  name="description" value={formData.description}
                  onChange={handleChange} rows={mode === 'view' ? 3 : 4}
                  placeholder="Описание задачи…" disabled={mode === 'view'}
                />
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
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
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
                  <input type="datetime-local" name="due_date" value={formData.due_date} onChange={handleChange} disabled={mode === 'view'} />
                </div>
                <div className="form-group">
                  <label>Оценка (часы)</label>
                  <input type="number" name="estimated_hours" value={formData.estimated_hours} onChange={handleChange} step="0.5" min="0" placeholder="напр. 4.5" disabled={mode === 'view'} />
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-footer">
                {mode === 'view' && onTaskDelete && (
                  <button type="button" className="btn-danger" onClick={handleDelete}>
                    Удалить
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={onClose}>
                  {mode === 'view' ? 'Закрыть' : 'Отмена'}
                </button>
                {mode !== 'view' && (
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? <span className="spinner" /> : 'Создать задачу'}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* ── Right: comments (view mode only) ── */}
          {mode === 'view' && (
            <div className="tm-comments-col">
              <div className="tm-comments-header">
                <span className="tm-comments-title">Комментарии</span>
                <span className="tm-comments-count">{comments.length}</span>
              </div>

              <div className="tm-comment-list" ref={commentListRef}>
                {comments.length === 0 ? (
                  <div className="tm-comments-empty">
                    Нет комментариев. Напишите первым!
                  </div>
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
                              <button
                                className="tm-comment-del"
                                onClick={() => handleDeleteComment(c.id)}
                                title="Удалить"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className="tm-comment-text">{c.text}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="tm-comment-input-wrap">
                <textarea
                  className="tm-comment-input"
                  placeholder="Написать комментарий… (Ctrl+Enter)"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={onCommentKey}
                  rows={2}
                />
                <button
                  className="tm-comment-send"
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || commentLoading}
                  title="Отправить (Ctrl+Enter)"
                >
                  {commentLoading ? (
                    <span className="tm-comment-spinner" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
