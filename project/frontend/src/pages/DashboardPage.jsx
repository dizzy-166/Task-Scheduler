import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleName = (role) => {
    const roles = {
      admin: 'Администратор',
      manager: 'Менеджер',
      executor: 'Исполнитель',
      observer: 'Наблюдатель',
    };
    return roles[role] || role;
  };

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-brand">ControlFlow</div>
        <div className="navbar-user">
          <span className="user-info">{user?.full_name || user?.email}</span>
          <button onClick={handleLogout} className="btn-logout">
            Выйти
          </button>
        </div>
      </nav>
      
      <div className="dashboard-content">
        <div className="welcome-card">
          <h2 className="welcome-title">
            Добро пожаловать, {user?.first_name || 'пользователь'}!
          </h2>
          
          <div className="user-details">
            <div className="detail-item">
              <div className="detail-label">Email</div>
              <div className="detail-value">{user?.email}</div>
            </div>
            
            <div className="detail-item">
              <div className="detail-label">Полное имя</div>
              <div className="detail-value">{user?.full_name || '—'}</div>
            </div>
            
            <div className="detail-item">
              <div className="detail-label">Роль</div>
              <div className="detail-value">{getRoleName(user?.role)}</div>
            </div>
            
            <div className="detail-item">
              <div className="detail-label">Статус</div>
              <div className="detail-value">
                {user?.is_active ? '🟢 Активен' : '🔴 Неактивен'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;