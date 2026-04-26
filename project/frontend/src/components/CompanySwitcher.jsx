import { useEffect, useState } from 'react';
import useCompanyStore from '../store/companyStore';
import { useNavigate } from 'react-router-dom';

const CompanySwitcher = () => {
  const { 
    companies, 
    activeCompany, 
    setActiveCompany, 
    fetchCompanies, 
    createCompany,
    fetchInvites,
    invites 
  } = useCompanyStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInvitesModal, setShowInvitesModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDesc, setNewCompanyDesc] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    console.log('CompanySwitcher: fetching companies and invites');
    fetchCompanies();
    fetchInvites();
  }, []);

  const handleChange = (event) => {
    const selectedId = event.target.value;
    if (selectedId === 'create_new') {
      setShowCreateModal(true);
      return;
    }
    if (selectedId === 'show_invites') {
      setShowInvitesModal(true);
      return;
    }
    const company = companies.find(c => String(c.id) === selectedId);
    console.log('Selected company:', company);
    if (company) {
      setActiveCompany(company);
      console.log('Active company set to:', company);
      navigate('/dashboard');
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      setError('Название компании обязательно');
      return;
    }
    
    const result = await createCompany({
      name: newCompanyName,
      description: newCompanyDesc
    });
    
    if (result.success) {
      setShowCreateModal(false);
      setNewCompanyName('');
      setNewCompanyDesc('');
      setError('');
      setActiveCompany(result.company);
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  const handleAcceptInvite = async (companyId) => {
    const { respondToInvite } = useCompanyStore.getState();
    const result = await respondToInvite(companyId, 'accept');
    if (result.success) {
      setShowInvitesModal(false);
    }
  };

  const handleDeclineInvite = async (companyId) => {
    const { respondToInvite } = useCompanyStore.getState();
    await respondToInvite(companyId, 'decline');
  };

  return (
    <>
      <div className="company-switcher">
        <select
          value={activeCompany?.id || ''}
          onChange={handleChange}
        >
          <option value="">Выберите компанию</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
          <option disabled>──────────</option>
          <option value="show_invites">
            📨 Приглашения {invites.length > 0 ? `(${invites.length})` : ''}
          </option>
          <option value="create_new">+ Создать компанию</option>
        </select>
        
        {activeCompany && (
          <div className="current-company">
            <span className="company-badge">🏢 {activeCompany.name}</span>
          </div>
        )}
      </div>

      {/* Модальное окно создания компании */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Создание новой компании</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleCreateCompany(); }}>
              <div className="form-group">
                <label>Название компании *</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Введите название"
                  autoFocus
                />
              </div>
              
              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={newCompanyDesc}
                  onChange={(e) => setNewCompanyDesc(e.target.value)}
                  rows="3"
                  placeholder="Краткое описание компании"
                />
              </div>
              
              {error && <div className="error-message">{error}</div>}
              
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно приглашений */}
      {showInvitesModal && (
        <div className="modal-overlay" onClick={() => setShowInvitesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
                      {invite.invited_by_name && (
                        <p>Пригласил: {invite.invited_by_name}</p>
                      )}
                    </div>
                    <div className="invite-actions">
                      <button 
                        className="btn-primary btn-small"
                        onClick={() => handleAcceptInvite(invite.company)}
                      >
                        Принять
                      </button>
                      <button 
                        className="btn-secondary btn-small"
                        onClick={() => handleDeclineInvite(invite.company)}
                      >
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