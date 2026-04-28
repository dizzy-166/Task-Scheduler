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

  // Проверка прав на управление ролями
  const canManage = ['owner', 'admin'].includes(currentUserRole);
  
  // Дополнительная проверка через API (если пользователь имеет право roles.manage)
  const [hasRoleManagePermission, setHasRoleManagePermission] = useState(false);
  
  useEffect(() => {
    checkPermissions();
    load();
  }, [companyId]);

  const checkPermissions = async () => {
    try {
      // Проверяем, есть ли у пользователя право управлять ролями
      const perms = await rolesService.getPermissions();
      // Здесь можно добавить проверку конкретного права
      setHasRoleManagePermission(canManage);
    } catch (err) {
      console.error('Ошибка проверки прав:', err);
    }
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [r, p] = await Promise.all([
        rolesService.getRoles(companyId),
        rolesService.getPermissions(),
      ]);
      setRoles(r);
      setAllPerms(p);
      if (r.length > 0) setSelected(r[0]);
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
      setSelected(roles.find(r => r.id !== role.id) || null);
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

  async function loadMemberRoles(userId) {
    if (memberRoles[userId]) return;
    try {
      const data = await rolesService.getMemberRoles(companyId, userId);
      setMemberRoles(prev => ({ ...prev, [userId]: data.map(ur => ur.role) }));
    } catch (err) {
      console.error('Ошибка загрузки ролей участника:', err);
    }
  }

  async function toggleMemberRole(userId, roleId, hasRole) {
    if (!canManage && !hasRoleManagePermission) {
      setError('У вас нет прав на управление ролями');
      return;
    }
    
    try {
      if (hasRole) {
        await rolesService.removeRole(companyId, userId, roleId);
      } else {
        await rolesService.assignRole(companyId, userId, roleId);
      }
      const data = await rolesService.getMemberRoles(companyId, userId);
      setMemberRoles(prev => ({ ...prev, [userId]: data.map(ur => ur.role) }));
      setError(null);
    } catch (err) {
      console.error('Ошибка изменения роли участника:', err);
      setError('Не удалось изменить роль участника');
    }
  }

  // Группируем permissions по ресурсу
  const grouped = allPerms.reduce((acc, p) => {
    (acc[p.resource] = acc[p.resource] || []).push(p);
    return acc;
  }, {});

  const isDirty = selected && JSON.stringify([...pendingPerms].sort()) !== JSON.stringify([...(selected.permissions || [])].sort());

  // Если нет прав на управление ролями
  if (!canManage && !hasRoleManagePermission) {
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

        {/* Sidebar */}
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
                {canManage && !role.is_system && (
                  <button
                    className="role-delete-btn"
                    onClick={e => { e.stopPropagation(); handleDelete(role); }}
                    title="Удалить роль"
                  >×</button>
                )}
              </li>
            ))}
          </ul>

          {canManage && (
            <form className="roles-create-form" onSubmit={handleCreate}>
              <input
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                placeholder="Новая роль..."
                maxLength={50}
              />
              <button type="submit" disabled={creating || !newRoleName.trim()}>+</button>
            </form>
          )}
          
          {!canManage && (
            <div className="roles-readonly-notice">
              <span>🔒 Только для просмотра</span>
            </div>
          )}
        </div>

        {/* Main */}
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
                        <label key={perm.code} className={`perm-row ${!canManage || selected.is_system ? 'disabled' : ''}`}>
                          <div className="perm-info">
                            <span className="perm-name">{PERMISSION_LABELS[perm.code] || perm.code}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={pendingPerms.has(perm.code)}
                            onChange={() => togglePerm(perm.code)}
                            disabled={!canManage || selected.is_system}
                          />
                        </label>
                      ))}
                    </div>
                  ))}

                  {!canManage && (
                    <div className="roles-readonly-message">
                      <p>ⓘ Только владельцы и администраторы могут изменять разрешения</p>
                    </div>
                  )}

                  {canManage && !selected.is_system && (
                    <div className="roles-save-bar">
                      {isDirty && (
                        <button className="btn-secondary" onClick={() => setPendingPerms(new Set(selected.permissions))}>
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
                    {canManage 
                      ? 'Назначьте эту роль участникам компании'
                      : 'Просмотр участников с этой ролью'}
                  </p>
                  {members.map(m => {
                    if (!memberRoles[m.user] && canManage) loadMemberRoles(m.user);
                    const userRoles = memberRoles[m.user] || [];
                    const hasThisRole = userRoles.some(r => r.id === selected.id);
                    return (
                      <div key={m.user} className="roles-member-row">
                        <div className="roles-member-info">
                          <span className="roles-member-avatar">
                            {(m.user_name || m.user_email || '?')[0].toUpperCase()}
                          </span>
                          <div>
                            <div className="roles-member-name">{m.user_name || 'Пользователь'}</div>
                            <div className="roles-member-email">{m.user_email}</div>
                          </div>
                        </div>
                        {canManage ? (
                          <button
                            className={hasThisRole ? 'btn-danger-sm' : 'btn-primary-sm'}
                            onClick={() => toggleMemberRole(m.user, selected.id, hasThisRole)}
                          >
                            {hasThisRole ? 'Снять' : 'Назначить'}
                          </button>
                        ) : (
                          <span className="role-assigned-badge">
                            {hasThisRole ? '✓ Назначена' : '—'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}