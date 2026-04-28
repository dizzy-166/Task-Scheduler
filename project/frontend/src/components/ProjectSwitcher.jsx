import { useEffect, useRef, useState } from 'react';
import useProjectStore from '../store/projectStore';

const ProjectSwitcher = ({ companyId, currentUserRole }) => {
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

  const handleDelete = async (id) => {
    await deleteProject(id);
    setShowDeleteConfirm(null);
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

            {projects.map(project => (
              <div key={project.id} className="project-dropdown-item-wrapper">
                <button
                  className={`project-dropdown-item ${activeProject?.id === project.id ? 'active' : ''}`}
                  onClick={() => handleSelect(project)}
                >
                  <span className="project-status-dot" style={{ background: project.status === 'active' ? '#4CAF50' : '#9E9E9E' }} />
                  <span>{project.name}</span>
                  {activeProject?.id === project.id && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
            ))}

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
            <div className="modal-header">
              <h3>Удалить проект?</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Удалить проект <strong>{showDeleteConfirm.name}</strong>?</p>
              <p>Задачи проекта не будут удалены.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>Отмена</button>
              <button className="btn-danger" onClick={() => handleDelete(showDeleteConfirm.id)}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectSwitcher;
