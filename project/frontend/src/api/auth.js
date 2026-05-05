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

// ── Token refresh queue ───────────────────────────────────────────────────────
// Prevents multiple parallel 401s from each firing their own refresh request.
// The first 401 does the refresh; all others wait in failedQueue and are
// retried once the new token arrives (or rejected if refresh itself fails).

let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token));
  failedQueue = [];
};

const dispatchSessionExpired = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  sessionStorage.setItem('session_expired', '1');
  window.dispatchEvent(new Event('auth:session_expired'));
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // While a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(token => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      isRefreshing = false;
      processQueue(error);
      dispatchSessionExpired();
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh: refreshToken });
      const newToken = data.access;
      localStorage.setItem('accessToken', newToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      processQueue(null, newToken);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      dispatchSessionExpired();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  getProfile: () => api.get('/users/me/'),
  updateProfile: (data) => api.patch('/users/me/', data),
  changePassword: (data) => api.post('/users/change_password/', data),
  verifyEmail: (email, code) => api.post('/auth/verify-email/', { email, code }),
  resendVerification: (email) => api.post('/auth/resend-verification/', { email }),
  forgotPassword: (email) => api.post('/auth/forgot-password/', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password/', { token, password }),
};

export default api;