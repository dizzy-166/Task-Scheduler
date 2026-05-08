import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notVerified, setNotVerified] = useState(false);
  const navigate = useNavigate();
  const { login, resendVerification, isLoading, error } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotVerified(false);
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else if (result.error?.includes('Подтвердите email')) {
      setNotVerified(true);
    }
  };

  return (
    <div className="login-container">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#6366f1"/>
            <rect x="7" y="9"    width="18" height="3.5" rx="1.75" fill="white"/>
            <rect x="7" y="14.5" width="13" height="3.5" rx="1.75" fill="white" fillOpacity="0.7"/>
            <rect x="7" y="20"   width="8"  height="3.5" rx="1.75" fill="white" fillOpacity="0.4"/>
          </svg>
        </div>
        <h1 className="auth-title">Поток</h1>
        <p className="auth-subtitle">вход в систему</p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="global-error">
              {error}
              {notVerified && email && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                    onClick={() => resendVerification(email)}
                  >
                    Отправить письмо повторно
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label>Пароль</label>
              <Link to="/forgot-password" className="forgot-password-link">Забыли пароль?</Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="········"
              required
            />
          </div>

          <button type="submit" className="btn" disabled={isLoading}>
            {isLoading ? <span className="spinner"></span> : 'Войти'}
          </button>

          <p className="auth-subtitle" style={{ marginTop: '24px' }}>
            Нет аккаунта? <Link to="/register">Регистрация</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;