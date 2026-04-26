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
        set({ isLoading: true, error: null });
        try {
          const response = await companyAPI.getMyCompanies();
          const companies = response.data.results || response.data;
          set({ companies, isLoading: false });
          
          // Если нет активной компании, выбираем первую
          const { activeCompany } = get();
          if (!activeCompany && companies.length > 0) {
            set({ activeCompany: companies[0] });
          }
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
          const message = error.response?.data?.error || 'Ошибка';
          return { success: false, error: message };
        }
      },

      // Пригласить участника
      inviteMember: async (companyId, data) => {
        try {
          const response = await companyAPI.inviteMember(companyId, data);
          return { success: true, data: response.data };
        } catch (error) {
          const message = error.response?.data?.error || 'Ошибка приглашения';
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