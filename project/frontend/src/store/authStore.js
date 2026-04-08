import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../api/auth';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authAPI.login({ email, password });
          const { access, refresh } = response.data;
          
          localStorage.setItem('accessToken', access);
          localStorage.setItem('refreshToken', refresh);
          
          const profileResponse = await authAPI.getProfile();
          
          set({
            user: profileResponse.data,
            isAuthenticated: true,
            isLoading: false,
          });
          
          return { success: true };
        } catch (error) {
          const errorMessage = error.response?.data?.detail || 
                               error.response?.data?.errors?.[0] || 
                               'Ошибка входа';
          set({
            error: errorMessage,
            isLoading: false,
          });
          return { success: false, error: errorMessage };
        }
      },
      
      register: async (userData) => {
        set({ isLoading: true, error: null });
        
        try {
          await authAPI.register(userData);
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          let errorMessage = 'Ошибка регистрации';
          
          if (error.response?.data) {
            const data = error.response.data;
            if (typeof data === 'string') {
              errorMessage = data;
            } else if (data.errors) {
              errorMessage = data.errors.join('; ');
            } else if (data.detail) {
              errorMessage = data.detail;
            } else if (data.email) {
              errorMessage = Array.isArray(data.email) ? data.email[0] : data.email;
            }
          }
          
          set({
            error: errorMessage,
            isLoading: false,
          });
          return { success: false, error: errorMessage };
        }
      },
      
      logout: async () => {
        const refresh = localStorage.getItem('refreshToken');
        
        try {
          if (refresh) {
            await authAPI.logout(refresh);
          }
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          set({ user: null, isAuthenticated: false });
        }
      },
      
      fetchProfile: async () => {
        try {
          const response = await authAPI.getProfile();
          set({ user: response.data, isAuthenticated: true });
        } catch (error) {
          set({ user: null, isAuthenticated: false });
        }
      },
      
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

export default useAuthStore;