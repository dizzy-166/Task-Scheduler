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
              <Link to="/forgot-password" style={{ fontSize: '13px' }}>Забыли пароль?</Link>
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