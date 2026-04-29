import { useEffect, useRef, useState } from 'react';

const MemberActionsMenu = ({ member, currentUserRole, onChangeRole, onRemoveMember }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (member.role === 'owner') return null;

  const canManage = currentUserRole === 'owner';
  const roleLabel = member.role === 'admin' ? 'Администратор' : 'Участник';

  return (
    <div className="member-menu" ref={ref}>
      <button className="member-menu-trigger" onClick={() => setOpen(o => !o)}>
        <span className="member-menu-role-label">{roleLabel}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="member-menu-dropdown">
          <div className="member-menu-section-label">Роль</div>
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
