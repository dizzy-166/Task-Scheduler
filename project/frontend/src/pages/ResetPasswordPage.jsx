import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const [done, setDone] = useState(false);
  const { resetPassword, isLoading, error } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (password.length < 8) {
      setLocalError('Пароль должен содержать не менее 8 символов.');
      return;
    }
    if (password !== confirm) {
      setLocalError('Пароли не совпадают.');
      return;
    }

    const result = await resetPassword(token, password);
    if (result.success) {
      setDone(true);
    }
  };

  if (!token) {
    return (
      <div className="login-container">
        <div className="auth-card">
          <h1 className="auth-title">Поток</h1>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <p className="auth-subtitle" style={{ marginBottom: '20px' }}>
              Ссылка недействительна. Запросите сброс пароля заново.
            </p>
            <p className="auth-subtitle">
              <Link to="/forgot-password">Запросить сброс</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="login-container">
        <div className="auth-card">
          <h1 className="auth-title">Поток</h1>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>Пароль изменён!</p>
            <p className="auth-subtitle" style={{ marginBottom: '24px' }}>
              Войдите с новым паролем.
            </p>
            <Link to="/login" className="btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Войти
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="auth-card">
        <h1 className="auth-title">Поток</h1>
        <p className="auth-subtitle">новый пароль</p>

        <form onSubmit={handleSubmit}>
          {(error || localError) && (
            <div className="global-error">{localError || error}</div>
          )}

          <div className="form-group">
            <label>Новый пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="········"
              required
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label>Подтверждение пароля</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="········"
              required
            />
          </div>

          <button type="submit" className="btn" disabled={isLoading}>
            {isLoading ? <span className="spinner"></span> : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
