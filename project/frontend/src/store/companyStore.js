import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import companyAPI from '../api/companyService';

const useCompanyStore = create(
  persist(
    (set, get) => ({
      activeCompany: null, // { id, name, description, owner, ... }
      companies: [],
      invites: [],
      isLoading: false,
      error: null,

      // Загрузить компании пользователя
      fetchCompanies: async () => {
        console.log('Fetching companies...');
        set({ isLoading: true, error: null });
        try {
          const response = await companyAPI.getMyCompanies();
          const companies = response.data.results || response.data;
          console.log('Fetched companies:', companies);

          const currentActive = get().activeCompany;
          const activeExists = currentActive && companies.some(c => c.id === currentActive.id);
          const activeCompany = activeExists ? currentActive : (companies[0] || null);

          set({ companies, activeCompany, isLoading: false });
        } catch (error) {
          set({ error: 'Ошибка загрузки компаний', isLoading: false });
          console.error('Error fetching companies:', error);
        }
      },

      // Создать компанию
      createCompany: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await companyAPI.createCompany(data);
          const newCompany = response.data;
          set((state) => ({
            companies: [...state.companies, newCompany],
            activeCompany: state.activeCompany || newCompany,
            isLoading: false,
          }));
          return { success: true, company: newCompany };
        } catch (error) {
          const message = error.response?.data?.detail || 'Ошибка создания компании';
          set({ error: message, isLoading: false });
          return { success: false, error: message };
        }
      },

      // Удалить компанию
      deleteCompany: async (companyId) => {
        set({ isLoading: true, error: null });
        try {
          await companyAPI.deleteCompany(companyId);
          set((state) => {
            const updatedCompanies = state.companies.filter(c => c.id !== companyId);
            const isDeletedActiveCompany = state.activeCompany?.id === companyId;
            return {
              companies: updatedCompanies,
              activeCompany: isDeletedActiveCompany ? (updatedCompanies[0] || null) : state.activeCompany,
              isLoading: false,
            };
          });
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.detail || 'Ошибка удаления компании';
          set({ error: message, isLoading: false });
          return { success: false, error: message };
        }
      },

      // Установить активную компанию
      setActiveCompany: (company) => {
        set({ activeCompany: company });
      },

      // Загрузить приглашения
      fetchInvites: async () => {
        try {
          const response = await companyAPI.getMyInvites();
          set({ invites: response.data.results || response.data });
        } catch (error) {
          console.error('Error fetching invites:', error);
        }
      },

      // Ответить на приглашение
      respondToInvite: async (companyId, action) => {
        try {
          await companyAPI.respondToInvite(companyId, action);
          if (action === 'accept') {
            await get().fetchCompanies();
          }
          await get().fetchInvites();
          return { success: true };
        } catch (error) {
          const formatError = (error) => {
            const data = error.response?.data;
            if (!data) return error.message || 'Ошибка';
            if (typeof data === 'string') return data;
            if (data.error) return data.error;
            if (data.detail) return data.detail;
            return Object.entries(data).map(([key, value]) => {
              if (Array.isArray(value)) {
                return `${key}: ${value.join(' ')}`;
              }
              return `${key}: ${value}`;
            }).join(' ');
          };

          const message = formatError(error);
          return { success: false, error: message };
        }
      },

      // Пригласить участника
      inviteMember: async (companyId, data) => {
        console.log('Inviting member to company:', companyId, 'with data:', data);
        try {
          const response = await companyAPI.inviteMember(companyId, data);
          console.log('Invite response:', response);
          return { success: true, data: response.data };
        } catch (error) {
          console.error('Invite error:', error);
          const formatError = (error) => {
            const data = error.response?.data;
            if (!data) return error.message || 'Ошибка приглашения';
            if (typeof data === 'string') return data;
            if (data.error) return data.error;
            if (data.detail) return data.detail;
            return Object.entries(data).map(([key, value]) => {
              if (Array.isArray(value)) {
                return `${key}: ${value.join(' ')}`;
              }
              return `${key}: ${value}`;
            }).join(' ');
          };
          const message = formatError(error);
          return { success: false, error: message };
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'company-storage',
      partialize: (state) => ({
        activeCompany: state.activeCompany,
      }),
    }
  )
);

export default useCompanyStore;