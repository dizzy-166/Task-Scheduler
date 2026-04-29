import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем токен и ID компании к запросам
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const companyStorage = localStorage.getItem('company-storage');
      if (companyStorage) {
        const companyState = JSON.parse(companyStorage);
        if (companyState?.state?.activeCompany?.id) {
          config.headers['X-Company-Id'] = companyState.state.activeCompany.id;
        }
      }
    } catch (e) {
      console.error('Auth interceptor: Failed to parse company-storage', e);
    }

    try {
      const projectStorage = localStorage.getItem('project-storage');
      if (projectStorage) {
        const projectState = JSON.parse(projectStorage);
        if (projectState?.state?.activeProject?.id) {
          config.headers['X-Project-Id'] = projectState.state.activeProject.id;
        }
      }
    } catch (e) {
      // ignore
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Флаг чтобы не диспатчить событие несколько раз при пачке параллельных 401
let _sessionExpiredDispatched = false;

const _dispatchSessionExpired = () => {
  if (_sessionExpiredDispatched) return;
  _sessionExpiredDispatched = true;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  sessionStorage.setItem('session_expired', '1');
  window.dispatchEvent(new Event('auth:session_expired'));
  // Сбрасываем флаг через секунду — на случай если пользователь снова залогинится
  setTimeout(() => { _sessionExpiredDispatched = false; }, 1000);
};

// Обработка истечения токена
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });

          localStorage.setItem('accessToken', response.data.access);
          originalRequest.headers.Authorization = `Bearer ${response.data.access}`;

          return api(originalRequest);
        } catch {
          _dispatchSessionExpired();
        }
      } else {
        _dispatchSessionExpired();
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  getProfile: () => api.get('/users/me/'),
  updateProfile: (data) => api.patch('/users/me/', data),
  changePassword: (data) => api.post('/users/change_password/', data),
};

export default api;