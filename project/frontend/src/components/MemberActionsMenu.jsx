import { useEffect, useRef, useState } from 'react';

const MemberActionsMenu = ({
  member,
  currentUserRole,
  availableCustomRoles,
  onChangeRole,
  onAssignCustomRole,
  onRemoveCustomRole,
  onRemoveMember,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isOwner = member.role === 'owner';
  const canManage = currentUserRole === 'owner' && !isOwner;

  if (isOwner) return null;

  const unassignedCustomRoles = availableCustomRoles.filter(
    r => !member.roles?.some(mr => mr.id === r.id)
  );

  return (
    <div className="member-menu" ref={ref}>
      <button className="member-menu-trigger" onClick={() => setOpen(o => !o)}>
        <span className="member-menu-role-label">
          {member.role === 'admin' ? 'Администратор' : 'Участник'}
        </span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="member-menu-dropdown">
          {/* System role */}
          <div className="member-menu-section-label">Системная роль</div>
          {['member', 'admin'].map(role => (
            <button
              key={role}
              className={`member-menu-item ${member.role === role ? 'active' : ''}`}
              onClick={() => { onChangeRole(member.user, role); setOpen(false); }}
            >
              {member.role === role && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
              {role === 'admin' ? 'Администратор' : 'Участник'}
            </button>
          ))}

          {/* Custom roles */}
          {canManage && (unassignedCustomRoles.length > 0 || (member.roles && member.roles.length > 0)) && (
            <>
              <div className="member-menu-divider" />
              <div className="member-menu-section-label">Кастомные роли</div>

              {member.roles?.map(role => (
                <button
                  key={role.id}
                  className="member-menu-item member-menu-item--role-assigned"
                  onClick={() => { onRemoveCustomRole(member.user, role.id); setOpen(false); }}
                  title="Нажмите, чтобы снять роль"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {role.name}
                  <span className="member-menu-remove-hint">снять</span>
                </button>
              ))}

              {unassignedCustomRoles.map(role => (
                <button
                  key={role.id}
                  className="member-menu-item member-menu-item--role"
                  onClick={() => { onAssignCustomRole(member.user, role.id); setOpen(false); }}
                >
                  <span className="member-menu-plus">+</span>
                  {role.name}
                </button>
              ))}
            </>
          )}

          {/* Remove member */}
          {canManage && (
            <>
              <div className="member-menu-divider" />
              <button
                className="member-menu-item member-menu-item--danger"
                onClick={() => { onRemoveMember(member.user); setOpen(false); }}
              >
                Удалить участника
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MemberActionsMenu;
