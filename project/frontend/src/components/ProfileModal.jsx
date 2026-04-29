import { useState } from 'react';
import useAuthStore from '../store/authStore';
import { authAPI } from '../api/auth';

export default function ProfileModal({ onClose, onProfileUpdated }) {
  const { user, updateProfile } = useAuthStore();

  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    patronymic: user?.patronymic || '',
    phone: user?.phone || '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', new_password_confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('') || user?.email?.[0]?.toUpperCase() || '?';

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    const result = await updateProfile(profileForm);
    setProfileMsg(result.success ? { type: 'ok', text: 'Профиль сохранён' } : { type: 'err', text: result.error });
    if (result.success) onProfileUpdated?.();
    setProfileSaving(false);
  };

  const handlePwSave = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.new_password_confirm) {
      setPwMsg({ type: 'err', text: 'Новые пароли не совпадают' });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await authAPI.changePassword(pwForm);
      setPwMsg({ type: 'ok', text: 'Пароль изменён' });
      setPwForm({ old_password: '', new_password: '', new_password_confirm: '' });
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.old_password?.[0] || data?.new_password?.[0] || data?.detail || 'Ошибка смены пароля';
      setPwMsg({ type: 'err', text: msg });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="profile-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Профиль</h2>
          <button className="panel-close" onClick={onClose}>×</button>
        </div>

        <div className="profile-panel-body">
          {/* Avatar */}
          <div className="profile-avatar-block">
            <div className="profile-avatar-large">{initials}</div>
            <div className="profile-avatar-info">
              <div className="profile-display-name">{user?.full_name || user?.email}</div>
              <div className="profile-email">{user?.email}</div>
            </div>
          </div>

          {/* Profile form */}
          <form className="profile-section" onSubmit={handleProfileSave}>
            <h3 className="profile-section-title">Личные данные</h3>
            <div className="profile-form-row">
              <div className="form-group">
                <label>Имя</label>
                <input
                  type="text"
                  value={profileForm.first_name}
                  onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder="Имя"
                />
              </div>
              <div className="form-group">
                <label>Фамилия</label>
                <input
                  type="text"
                  value={profileForm.last_name}
                  onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder="Фамилия"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Отчество</label>
              <input
                type="text"
                value={profileForm.patronymic}
                onChange={e => setProfileForm(f => ({ ...f, patronymic: e.target.value }))}
                placeholder="Отчество"
              />
            </div>
            <div className="form-group">
              <label>Телефон</label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+7 (999) 000-00-00"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={user?.email || ''} disabled className="input-disabled" />
            </div>
            {profileMsg && (
              <div className={`profile-msg ${profileMsg.type === 'ok' ? 'profile-msg--ok' : 'profile-msg--err'}`}>
                {profileMsg.text}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={profileSaving}>
              {profileSaving ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </form>

          <div className="profile-divider" />

          {/* Password form */}
          <form className="profile-section" onSubmit={handlePwSave}>
            <h3 className="profile-section-title">Изменить пароль</h3>
            <div className="form-group">
              <label>Текущий пароль</label>
              <input
                type="password"
                value={pwForm.old_password}
                onChange={e => setPwForm(f => ({ ...f, old_password: e.target.value }))}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="form-group">
              <label>Новый пароль</label>
              <input
                type="password"
                value={pwForm.new_password}
                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="form-group">
              <label>Повторите новый пароль</label>
              <input
                type="password"
                value={pwForm.new_password_confirm}
                onChange={e => setPwForm(f => ({ ...f, new_password_confirm: e.target.value }))}
                placeholder="••••••••"
                required
              />
            </div>
            {pwMsg && (
              <div className={`profile-msg ${pwMsg.type === 'ok' ? 'profile-msg--ok' : 'profile-msg--err'}`}>
                {pwMsg.text}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={pwSaving}>
              {pwSaving ? 'Сохраняем...' : 'Сменить пароль'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
