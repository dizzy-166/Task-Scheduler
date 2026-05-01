import { useEffect, useRef, useState } from 'react';
import useCompanyStore from '../store/companyStore';
import useProjectStore from '../store/projectStore';
import { useNavigate } from 'react-router-dom';

const CompanySwitcher = () => {
  const {
    companies,
    activeCompany,
    setActiveCompany,
    fetchCompanies,
    createCompany,
    fetchInvites,
    invites,
  } = useCompanyStore();

  const { fetchProjects, clearProjects, setActiveProject } = useProjectStore();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInvitesModal, setShowInvitesModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDesc, setNewCompanyDesc] = useState('');
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchCompanies();
    fetchInvites();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCompany = (company) => {
    setActiveCompany(company);
    setActiveProject(null);
    clearProjects();
    setOpen(false);
    navigate('/dashboard');
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      setError('Название компании обязательно');
      return;
    }
    const result = await createCompany({ name: newCompanyName, description: newCompanyDesc });
    if (result.success) {
      setShowCreateModal(false);
      setNewCompanyName('');
      setNewCompanyDesc('');
      setError('');
      setActiveCompany(result.company);
      await fetchCompanies();
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  const handleAcceptInvite = async (companyId) => {
    const { respondToInvite } = useCompanyStore.getState();
    const result = await respondToInvite(companyId, 'accept');
    if (result.success) setShowInvitesModal(false);
  };

  const handleDeclineInvite = async (companyId) => {
    const { respondToInvite } = useCompanyStore.getState();
    await respondToInvite(companyId, 'decline');
  };

  return (
    <>
      <div className="company-switcher-v2" ref={dropdownRef}>
        <button
          className={`company-trigger ${open ? 'open' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          <span className="company-trigger-icon">🏢</span>
          <span className="company-trigger-name">
            {activeCompany?.name || 'Выберите компанию'}
          </span>
          <svg className="company-trigger-caret" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {open && (
          <div className="company-dropdown">
            {companies.length > 0 && (
              <>
                <div className="company-dropdown-section-label">Ваши компании</div>
                {companies.map(company => (
                  <button
                    key={company.id}
                    className={`company-dropdown-item ${activeCompany?.id === company.id ? 'active' : ''}`}
                    onClick={() => selectCompany(company)}
                  >
                    <span className="company-dropdown-icon">🏢</span>
                    <span>{company.name}</span>
                    {activeCompany?.id === company.id && (
                      <svg className="company-check" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                ))}
                <div className="company-dropdown-divider" />
              </>
            )}

            {invites.length > 0 && (
              <button
                className="company-dropdown-item company-dropdown-item--accent"
                onClick={() => { setOpen(false); setShowInvitesModal(true); }}
              >
                <span>📨</span>
                <span>Приглашения ({invites.length})</span>
              </button>
            )}

            <button
              className="company-dropdown-item"
              onClick={() => { setOpen(false); setShowCreateModal(true); }}
            >
              <span>+</span>
              <span>Создать компанию</span>
            </button>
          </div>
        )}
      </div>

      {/* Модальное окно создания компании */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Создание компании</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleCreateCompany(); }}>
              <div className="form-group">
                <label>Название *</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  placeholder="Введите название"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={newCompanyDesc}
                  onChange={e => setNewCompanyDesc(e.target.value)}
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

      {/* Приглашения */}
      {showInvitesModal && (
        <div className="modal-overlay" onClick={() => setShowInvitesModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Мои приглашения</h3>
              <button className="modal-close" onClick={() => setShowInvitesModal(false)}>×</button>
            </div>
            <div className="invites-list">
              {invites.length === 0 ? (
                <p className="empty-text">Нет активных приглашений</p>
              ) : (
                invites.map(invite => (
                  <div key={invite.id} className="invite-item">
                    <div className="invite-info">
                      <strong>{invite.company_name || invite.company?.name}</strong>
                      <p>Роль: {invite.role_display || invite.role}</p>
                      {invite.invited_by_name && <p>Пригласил: {invite.invited_by_name}</p>}
                    </div>
                    <div className="invite-actions">
                      <button className="btn-primary btn-small" onClick={() => handleAcceptInvite(invite.company)}>
                        Принять
                      </button>
                      <button className="btn-secondary btn-small" onClick={() => handleDeclineInvite(invite.company)}>
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CompanySwitcher;
