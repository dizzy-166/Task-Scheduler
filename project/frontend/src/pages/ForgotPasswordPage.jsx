import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { forgotPassword, isLoading, error } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await forgotPassword(email.trim());
    if (result.success) {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="login-container">
        <div className="auth-card">
          <h1 className="auth-title">Поток</h1>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉️</div>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>Письмо отправлено</p>
            <p className="auth-subtitle" style={{ marginBottom: '24px' }}>
              Если <strong>{email}</strong> зарегистрирован, вы получите письмо со ссылкой для сброса пароля.
              Ссылка действительна 1 час.
            </p>
            <p className="auth-subtitle" style={{ fontSize: '13px', marginBottom: '20px' }}>
              Не пришло? Проверьте папку «Спам».
            </p>
            <p className="auth-subtitle">
              <Link to="/login">Вернуться ко входу</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="auth-card">
        <h1 className="auth-title">Поток</h1>
        <p className="auth-subtitle">восстановление пароля</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="global-error">{error}</div>}

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

          <button type="submit" className="btn" disabled={isLoading}>
            {isLoading ? <span className="spinner"></span> : 'Отправить ссылку'}
          </button>

          <p className="auth-subtitle" style={{ marginTop: '24px' }}>
            <Link to="/login">← Вернуться ко входу</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
