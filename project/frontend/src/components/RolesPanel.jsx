// frontend/src/components/RolesPanel.jsx
import { useState, useEffect } from 'react';
import rolesService from '../api/rolesService';

const PERMISSION_LABELS = {
  'tasks.create':    'Создавать задачи',
  'tasks.edit_any':  'Редактировать любые задачи',
  'tasks.delete_any':'Удалять задачи',
  'tasks.assign':    'Назначать исполнителей',
  'tasks.view_all':  'Просматривать все задачи',
  'projects.create': 'Создавать проекты',
  'projects.edit':   'Редактировать проекты',
  'projects.delete': 'Удалять проекты',
  'members.invite':  'Приглашать участников',
  'members.remove':  'Удалять участников',
  'roles.manage':    'Управлять ролями',
};

const RESOURCE_LABELS = {
  tasks:    'Задачи',
  projects: 'Проекты',
  members:  'Участники',
  roles:    'Роли',
};

export default function RolesPanel({ companyId, members, currentUserRole, onClose }) {
  const [roles, setRoles] = useState([]);
  const [allPerms, setAllPerms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingPerms, setPendingPerms] = useState(new Set());
  const [memberRoles, setMemberRoles] = useState({});
  const [activeTab, setActiveTab] = useState('permissions');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMemberRoles, setLoadingMemberRoles] = useState(false);

  const canManage = ['owner', 'admin'].includes(currentUserRole);

  useEffect(() => {
    load();
  }, [companyId]);

  useEffect(() => {
    if (selected) {
      // Извлекаем permissions из role
      const perms = selected.permissions || [];
      setPendingPerms(new Set(perms));
    }
  }, [selected?.id]);

  // Загружаем роли для всех участников при открытии панели
  useEffect(() => {
    if (members.length > 0 && canManage) {
      loadAllMembersRoles();
    }
  }, [members, canManage]);

  async function loadAllMembersRoles() {
    setLoadingMemberRoles(true);
    const rolesMap = {};
    
    console.log('Loading roles for members:', members);
    
    for (const member of members) {
      try {
        const response = await rolesService.getMemberRoles(companyId, member.user);
        console.log(`Raw response for user ${member.user}:`, response);
        
        // Нормализуем данные - извлекаем массив ролей
        let userRoles = [];
        
        if (Array.isArray(response)) {
          userRoles = response;
        } else if (response && Array.isArray(response.results)) {
          userRoles = response.results;
        } else if (response && response.roles && Array.isArray(response.roles)) {
          userRoles = response.roles;
        } else if (response && typeof response === 'object') {
          // Пробуем найти массив в объекте
          for (const key of Object.keys(response)) {
            if (Array.isArray(response[key])) {
              userRoles = response[key];
              break;
            }
          }
        }
        
        // Извлекаем role объекты из UserRole
        const normalizedRoles = userRoles.map(item => {
          if (item.role) return item.role;
          if (item.id && item.name) return item;
          return item;
        });
        
        console.log(`Normalized roles for user ${member.user}:`, normalizedRoles);
        rolesMap[member.user] = normalizedRoles;
      } catch (err) {
        console.error(`Ошибка загрузки ролей для ${member.user}:`, err);
        rolesMap[member.user] = [];
      }
    }
    
    console.log('Final member roles map:', rolesMap);
    setMemberRoles(rolesMap);
    setLoadingMemberRoles(false);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [rolesData, permissionsData] = await Promise.all([
        rolesService.getRoles(companyId),
        rolesService.getPermissions(),
      ]);
      
      console.log('Raw roles data:', rolesData);
      console.log('Raw permissions data:', permissionsData);
      
      // Нормализуем роли
      let rolesList = [];
      if (Array.isArray(rolesData)) {
        rolesList = rolesData;
      } else if (rolesData && Array.isArray(rolesData.results)) {
        rolesList = rolesData.results;
      } else if (rolesData && typeof rolesData === 'object') {
        for (const key of Object.keys(rolesData)) {
          if (Array.isArray(rolesData[key])) {
            rolesList = rolesData[key];
            break;
          }
        }
      }
      
      // Нормализуем разрешения
      let permsList = [];
      if (Array.isArray(permissionsData)) {
        permsList = permissionsData;
      } else if (permissionsData && Array.isArray(permissionsData.results)) {
        permsList = permissionsData.results;
      } else if (permissionsData && typeof permissionsData === 'object') {
        for (const key of Object.keys(permissionsData)) {
          if (Array.isArray(permissionsData[key])) {
            permsList = permissionsData[key];
            break;
          }
        }
      }
      
      console.log('Normalized roles:', rolesList);
      console.log('Normalized permissions:', permsList);
      
      setRoles(rolesList);
      setAllPerms(permsList);
      if (rolesList.length > 0) setSelected(rolesList[0]);
    } catch (err) {
      console.error('Ошибка загрузки ролей:', err);
      setError('Не удалось загрузить роли');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreating(true);
    try {
      const role = await rolesService.createRole(companyId, newRoleName.trim());
      setRoles(prev => [...prev, role]);
      setSelected(role);
      setNewRoleName('');
    } catch (err) {
      console.error('Ошибка создания роли:', err);
      setError('Не удалось создать роль');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(role) {
    if (!window.confirm(`Удалить роль «${role.name}»?`)) return;
    try {
      await rolesService.deleteRole(companyId, role.id);
      setRoles(prev => prev.filter(r => r.id !== role.id));
      await loadAllMembersRoles();
      if (selected?.id === role.id) {
        setSelected(roles.find(r => r.id !== role.id) || null);
      }
    } catch (err) {
      console.error('Ошибка удаления роли:', err);
      setError('Не удалось удалить роль');
    }
  }

  async function handleSavePermissions() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await rolesService.setRolePermissions(companyId, selected.id, [...pendingPerms]);
      setRoles(prev => prev.map(r => r.id === updated.id ? updated : r));
      setSelected(updated);
      setError(null);
    } catch (err) {
      console.error('Ошибка сохранения разрешений:', err);
      setError('Не удалось сохранить разрешения');
    } finally {
      setSaving(false);
    }
  }

  function togglePerm(code) {
    setPendingPerms(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  async function toggleMemberRole(userId, roleId, currentlyHasRole) {
    if (!canManage) {
      setError('У вас нет прав на управление ролями');
      return;
    }
    
    console.log('Toggling role:', { userId, roleId, currentlyHasRole });
    
    try {
      if (currentlyHasRole) {
        await rolesService.removeRole(companyId, userId, roleId);
      } else {
        await rolesService.assignRole(companyId, userId, roleId);
      }
      
      // Обновляем роли конкретного участника
      const response = await rolesService.getMemberRoles(companyId, userId);
      console.log('Updated roles response:', response);
      
      let userRoles = [];
      if (Array.isArray(response)) {
        userRoles = response;
      } else if (response && Array.isArray(response.results)) {
        userRoles = response.results;
      }
      
      const normalizedRoles = userRoles.map(item => item.role || item);
      setMemberRoles(prev => ({
        ...prev,
        [userId]: normalizedRoles
      }));
      setError(null);
    } catch (err) {
      console.error('Ошибка изменения роли участника:', err);
      setError('Не удалось изменить роль участника');
    }
  }

  const userHasRole = (userId, roleId) => {
    const userRoles = memberRoles[userId] || [];
    const hasRole = userRoles.some(role => {
      if (!role) return false;
      // Сравниваем по id
      if (typeof role === 'object' && role.id) {
        return role.id === roleId;
      }
      // Если пришел просто id
      if (typeof role === 'string' || typeof role === 'number') {
        return role == roleId;
      }
      return false;
    });
    return hasRole;
  };

  // Группируем permissions по ресурсу
  const grouped = allPerms.reduce((acc, p) => {
    const resource = p.resource || p.code?.split('.')[0] || 'other';
    (acc[resource] = acc[resource] || []).push(p);
    return acc;
  }, {});

  const isDirty = selected && JSON.stringify([...pendingPerms].sort()) !== JSON.stringify([...(selected.permissions || [])].sort());

  if (!canManage) {
    return (
      <div className="roles-overlay" onClick={onClose}>
        <div className="roles-panel roles-no-access" onClick={e => e.stopPropagation()}>
          <div className="roles-sidebar-header">
            <h3>Роли</h3>
            <button className="roles-close-btn" onClick={onClose}>×</button>
          </div>
          <div className="roles-no-access-content">
            <div className="no-access-icon">🔒</div>
            <h3>Нет доступа</h3>
            <p>У вас недостаточно прав для управления ролями.</p>
            <p className="no-access-hint">Только владельцы и администраторы компании могут управлять ролями.</p>
            <button className="btn-primary" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="roles-overlay" onClick={onClose}>
        <div className="roles-panel" onClick={e => e.stopPropagation()}>
          <div className="roles-sidebar-header">
            <h3>Роли</h3>
            <button className="roles-close-btn" onClick={onClose}>×</button>
          </div>
          <div className="roles-loading">
            <div className="spinner"></div>
            <p>Загрузка ролей...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="roles-overlay" onClick={onClose}>
      <div className="roles-panel" onClick={e => e.stopPropagation()}>

        <div className="roles-sidebar">
          <div className="roles-sidebar-header">
            <h3>Роли</h3>
            <button className="roles-close-btn" onClick={onClose}>×</button>
          </div>

          {error && (
            <div className="roles-error">
              {error}
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          <ul className="roles-list">
            {roles.map(role => (
              <li
                key={role.id}
                className={`roles-list-item ${selected?.id === role.id ? 'active' : ''}`}
                onClick={() => setSelected(role)}
              >
                <span className="role-dot" />
                <span className="role-name">{role.name}</span>
                <span className="role-count">{role.members_count || 0}</span>
                {!role.is_system && (
                  <button
                    className="role-delete-btn"
                    onClick={e => { e.stopPropagation(); handleDelete(role); }}
                    title="Удалить роль"
                  >×</button>
                )}
              </li>
            ))}
          </ul>

          <form className="roles-create-form" onSubmit={handleCreate}>
            <input
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              placeholder="Новая роль..."
              maxLength={50}
            />
            <button type="submit" disabled={creating || !newRoleName.trim()}>+</button>
          </form>
        </div>

        <div className="roles-main">
          {!selected ? (
            <div className="roles-empty">Выберите роль</div>
          ) : (
            <>
              <div className="roles-main-header">
                <h2>{selected.name}</h2>
                <span className="roles-member-badge">{selected.members_count || 0} уч.</span>
              </div>

              <div className="roles-tabs">
                <button className={activeTab === 'permissions' ? 'active' : ''} onClick={() => setActiveTab('permissions')}>
                  Разрешения
                </button>
                <button className={activeTab === 'members' ? 'active' : ''} onClick={() => setActiveTab('members')}>
                  Участники
                </button>
              </div>

              {activeTab === 'permissions' && (
                <div className="roles-permissions">
                  {Object.entries(grouped).map(([resource, perms]) => (
                    <div key={resource} className="perm-group">
                      <div className="perm-group-label">{RESOURCE_LABELS[resource] || resource}</div>
                      {perms.map(perm => (
                        <label key={perm.code || perm.id} className={`perm-row ${selected.is_system ? 'disabled' : ''}`}>
                          <div className="perm-info">
                            <span className="perm-name">{PERMISSION_LABELS[perm.code] || perm.code || perm.name}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={pendingPerms.has(perm.code)}
                            onChange={() => togglePerm(perm.code)}
                            disabled={selected.is_system}
                          />
                        </label>
                      ))}
                    </div>
                  ))}

                  {!selected.is_system && (
                    <div className="roles-save-bar">
                      {isDirty && (
                        <button className="btn-secondary" onClick={() => setPendingPerms(new Set(selected.permissions || []))}>
                          Сбросить
                        </button>
                      )}
                      <button
                        className="btn-primary"
                        onClick={handleSavePermissions}
                        disabled={saving || !isDirty}
                      >
                        {saving ? 'Сохранение...' : 'Сохранить изменения'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'members' && (
                <div className="roles-members-tab">
                  <p className="roles-members-hint">
                    Назначьте эту роль участникам компании
                  </p>
                  
                  {loadingMemberRoles && (
                    <div className="roles-loading-small">
                      <div className="spinner-small"></div>
                      <span>Загрузка ролей участников...</span>
                    </div>
                  )}
                  
                  {members.map(m => {
                    const hasThisRole = userHasRole(m.user, selected.id);
                    
                    return (
                      <div key={m.user} className="roles-member-row">
                        <div className="roles-member-info">
                          <span className="roles-member-avatar">
                            {(m.user_name || m.user_email || '?')[0].toUpperCase()}
                          </span>
                          <div>
                            <div className="roles-member-name">{m.user_name || 'Пользователь'}</div>
                            <div className="roles-member-email">{m.user_email}</div>
                            {hasThisRole && (
                              <div className="roles-member-role-badge">✓ Имеет эту роль</div>
                            )}
                          </div>
                        </div>
                        <button
                          className={hasThisRole ? 'btn-danger-sm' : 'btn-primary-sm'}
                          onClick={() => toggleMemberRole(m.user, selected.id, hasThisRole)}
                          disabled={selected.is_system}
                        >
                          {hasThisRole ? 'Снять роль' : 'Назначить роль'}
                        </button>
                      </div>
                    );
                  })}
                  
                  {members.length === 0 && (
                    <div className="roles-empty-members">
                      <p>Нет участников в компании</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}