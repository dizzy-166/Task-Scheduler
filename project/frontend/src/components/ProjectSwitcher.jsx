import { useEffect, useRef, useState } from 'react';
import useProjectStore from '../store/projectStore';

const ProjectSwitcher = ({ companyId, currentUserRole, projectStats = {} }) => {
  const { projects, activeProject, fetchProjects, setActiveProject, createProject, deleteProject } =
    useProjectStore();

  const [open, setOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (companyId) fetchProjects();
  }, [companyId]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (project) => {
    setActiveProject(project);
    setOpen(false);
  };

  const handleClearProject = () => {
    setActiveProject(null);
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!newProjectName.trim()) {
      setError('Название обязательно');
      return;
    }
    const result = await createProject({ name: newProjectName, description: newProjectDesc });
    if (result.success) {
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      setError('');
      setActiveProject(result.project);
    } else {
      setError(result.error);
    }
  };

  const [taskAction, setTaskAction] = useState('archive');

  const handleDelete = async (id) => {
    await deleteProject(id, taskAction);
    setShowDeleteConfirm(null);
    setTaskAction('archive');
  };

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <>
      <div className="project-switcher" ref={dropdownRef}>
        <button
          className={`project-trigger ${open ? 'open' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className="project-trigger-name">
            {activeProject?.name || 'Все проекты'}
          </span>
          <svg className="project-trigger-caret" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {open && (
          <div className="project-dropdown">
            <button
              className={`project-dropdown-item ${!activeProject ? 'active' : ''}`}
              onClick={handleClearProject}
            >
              <span>Все проекты</span>
              {!activeProject && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
            </button>

            {projects.length > 0 && <div className="project-dropdown-divider" />}

            {projects.map(project => {
              const stats = projectStats[project.name];
              const total = stats?.total ?? 0;
              const done  = stats?.done  ?? 0;
              const pct   = total > 0 ? Math.round((done / total) * 100) : null;
              return (
                <div key={project.id} className="project-dropdown-item-wrapper">
                  <button
                    className={`project-dropdown-item ${activeProject?.id === project.id ? 'active' : ''}`}
                    onClick={() => handleSelect(project)}
                  >
                    <span className="project-status-dot" style={{ background: project.status === 'active' ? '#4CAF50' : '#9E9E9E' }} />
                    <div className="project-item-body">
                      <span>{project.name}</span>
                      {pct !== null && (
                        <div className="project-progress-wrap">
                          <div className="project-progress-bar">
                            <div className="project-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="project-progress-label">{done}/{total}</span>
                        </div>
                      )}
                    </div>
                    {activeProject?.id === project.id && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                  {canManage && (
                    <button
                      className="project-delete-btn"
                      onClick={e => { e.stopPropagation(); setShowDeleteConfirm(project); setOpen(false); }}
                      title="Удалить проект"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}

            {canManage && (
              <>
                <div className="project-dropdown-divider" />
                <button
                  className="project-dropdown-item project-dropdown-item--add"
                  onClick={() => { setOpen(false); setShowCreateModal(true); }}
                >
                  <span>+</span>
                  <span>Новый проект</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Создание проекта */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Новый проект</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleCreate(); }}>
              <div className="form-group">
                <label>Название *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="Название проекта"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={newProjectDesc}
                  onChange={e => setNewProjectDesc(e.target.value)}
                  rows="3"
                  placeholder="Краткое описание"
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Подтверждение удаления */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content modal-delete" onClick={e => e.stopPropagation()}>
            <button className="modal-close modal-delete-close" onClick={() => setShowDeleteConfirm(null)}>×</button>
            <div className="modal-delete-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <div className="modal-delete-body">
              <h3>Удалить проект?</h3>
              <p>Вы собираетесь удалить проект <strong>{showDeleteConfirm.name}</strong>. Что сделать с задачами проекта?</p>
              <div className="modal-delete-task-actions">
                <label className={`task-action-option ${taskAction === 'archive' ? 'selected' : ''}`}>
                  <input type="radio" name="taskAction" value="archive" checked={taskAction === 'archive'} onChange={() => setTaskAction('archive')} />
                  <span className="task-action-icon">📦</span>
                  <div>
                    <strong>Архивировать</strong>
                    <span>Задачи сохранятся в архиве</span>
                  </div>
                </label>
                <label className={`task-action-option ${taskAction === 'delete' ? 'selected' : ''}`}>
                  <input type="radio" name="taskAction" value="delete" checked={taskAction === 'delete'} onChange={() => setTaskAction('delete')} />
                  <span className="task-action-icon">🗑</span>
                  <div>
                    <strong>Удалить</strong>
                    <span>Задачи будут удалены без возможности восстановления</span>
                  </div>
                </label>
                <label className={`task-action-option ${taskAction === 'keep' ? 'selected' : ''}`}>
                  <input type="radio" name="taskAction" value="keep" checked={taskAction === 'keep'} onChange={() => setTaskAction('keep')} />
                  <span className="task-action-icon">📋</span>
                  <div>
                    <strong>Оставить</strong>
                    <span>Задачи останутся без проекта</span>
                  </div>
                </label>
              </div>
            </div>
            <div className="modal-delete-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>Отмена</button>
              <button className="btn-danger" onClick={() => handleDelete(showDeleteConfirm.id)}>Удалить проект</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectSwitcher;
