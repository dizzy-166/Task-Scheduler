import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const VerifyEmailPage = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [done, setDone] = useState(false);
  const { verifyEmail, resendVerification, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const result = await verifyEmail(email.trim(), code.trim());
    if (result.success) setDone(true);
  };

  const handleResend = async () => {
    clearError();
    setCode('');
    await resendVerification(email.trim());
  };

  if (done) {
    return (
      <div className="login-container">
        <div className="auth-card">
          <h1 className="auth-title">Поток</h1>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>Email подтверждён!</p>
            <p className="auth-subtitle" style={{ marginBottom: '24px' }}>Теперь можно войти.</p>
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
        <p className="auth-subtitle">подтверждение email</p>

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

          <div className="form-group">
            <label>Код из письма</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              style={{ letterSpacing: '4px', fontSize: '20px', textAlign: 'center' }}
            />
          </div>

          <button type="submit" className="btn" disabled={isLoading || code.length !== 6}>
            {isLoading ? <span className="spinner"></span> : 'Подтвердить'}
          </button>
        </form>

        <p className="auth-subtitle" style={{ marginTop: '16px', fontSize: '13px' }}>
          Не пришло? Проверьте «Спам» или{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={isLoading || !email}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '13px', textDecoration: 'underline' }}
          >
            отправить повторно
          </button>
        </p>
        <p className="auth-subtitle" style={{ marginTop: '8px' }}>
          <Link to="/login">← Войти</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
