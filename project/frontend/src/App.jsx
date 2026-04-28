import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import useAuthStore from './store/authStore';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import DashboardPage from './pages/DashboardPage';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? children : <Navigate to="/dashboard" />;
};

function AppContent() {
  const { fetchProfile, forceLogout } = useAuthStore();
  const navigate = useNavigate();
  const [sessionExpiredBanner, setSessionExpiredBanner] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchProfile();
    }

    const handleSessionExpired = () => {
      forceLogout();
      setSessionExpiredBanner(true);
      navigate('/login');
    };

    window.addEventListener('auth:session_expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session_expired', handleSessionExpired);
  }, []);

  return (
    <>
      {sessionExpiredBanner && (
        <div className="session-expired-banner">
          <span>Сессия истекла. Пожалуйста, войдите снова.</span>
          <button onClick={() => setSessionExpiredBanner(false)}>×</button>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginForm />
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterForm />
            </PublicRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
