import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
  });
  const [localErrors, setLocalErrors] = useState({});
  const [registeredEmail, setRegisteredEmail] = useState(null);
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const { register, verifyEmail, resendVerification, isLoading, error, clearError } = useAuthStore();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setLocalErrors({ ...localErrors, [e.target.name]: '' });
  };

  const validate = () => {
    const errors = {};
    if (!formData.email) errors.email = 'Email обязателен';
    if (!formData.password) errors.password = 'Пароль обязателен';
    if (formData.password !== formData.password_confirm) {
      errors.password_confirm = 'Пароли не совпадают';
    }
    if (!formData.first_name) errors.first_name = 'Имя обязательно';
    if (!formData.last_name) errors.last_name = 'Фамилия обязательна';
    setLocalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const result = await register(formData);
    if (result.success) {
      setRegisteredEmail(formData.email);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    clearError();
    const result = await verifyEmail(registeredEmail, code);
    if (result.success) setVerified(true);
  };

  const handleResend = async () => {
    clearError();
    setCode('');
    await resendVerification(registeredEmail);
  };

  if (verified) {
    return (
      <div className="register-container">
        <div className="auth-card">
          <h1 className="auth-title">Поток</h1>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>Email подтверждён!</p>
            <p className="auth-subtitle" style={{ marginBottom: '24px' }}>Аккаунт активирован. Можно войти.</p>
            <Link to="/login" className="btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Войти
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (registeredEmail) {
    return (
      <div className="register-container">
        <div className="auth-card">
          <h1 className="auth-title">Поток</h1>
          <p className="auth-subtitle">подтверждение email</p>
          <p className="auth-subtitle" style={{ marginBottom: '20px' }}>
            Мы отправили 6-значный код на <strong>{registeredEmail}</strong>
          </p>

          <form onSubmit={handleVerify}>
            {error && <div className="global-error">{error}</div>}
            <div className="form-group">
              <label>Код из письма</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                style={{ letterSpacing: '4px', fontSize: '20px', textAlign: 'center' }}
                autoFocus
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
              disabled={isLoading}
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
  }

  return (
    <div className="register-container">
      <div className="auth-card">
        <h1 className="auth-title">Поток</h1>
        <p className="auth-subtitle">регистрация</p>

        <form onSubmit={handleSubmit}>
          {error && typeof error === 'string' && (
            <div className="global-error">{error}</div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={localErrors.email ? 'error' : ''}
              placeholder="your@email.com"
            />
            {localErrors.email && (
              <div className="error-message">{localErrors.email}</div>
            )}
          </div>

          <div className="row">
            <div className="form-group">
              <label>Имя</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="Иван"
              />
            </div>

            <div className="form-group">
              <label>Фамилия</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Иванов"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="········"
            />
          </div>

          <div className="form-group">
            <label>Подтверждение пароля</label>
            <input
              type="password"
              name="password_confirm"
              value={formData.password_confirm}
              onChange={handleChange}
              className={localErrors.password_confirm ? 'error' : ''}
              placeholder="········"
            />
            {localErrors.password_confirm && (
              <div className="error-message">{localErrors.password_confirm}</div>
            )}
          </div>

          <button type="submit" className="btn" disabled={isLoading}>
            {isLoading ? <span className="spinner"></span> : 'Зарегистрироваться'}
          </button>

          <p className="auth-subtitle" style={{ marginTop: '24px' }}>
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterForm;