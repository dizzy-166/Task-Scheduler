import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import projectService from '../api/projectService';

const useProjectStore = create(
  persist(
    (set, get) => ({
      projects: [],
      activeProject: null,
      isLoading: false,
      error: null,

      fetchProjects: async () => {
        set({ isLoading: true, error: null });
        try {
          const data = await projectService.getProjects();
          const projects = Array.isArray(data) ? data : (data.results || []);
          set({ projects, isLoading: false });
          return projects;
        } catch (err) {
          set({ error: err.message, isLoading: false });
          return [];
        }
      },

      setActiveProject: (project) => set({ activeProject: project }),

      createProject: async (data) => {
        try {
          const project = await projectService.createProject(data);
          set(state => ({ projects: [...state.projects, project] }));
          return { success: true, project };
        } catch (err) {
          const msg =
            err.response?.data?.detail ||
            err.response?.data?.name?.[0] ||
            'Ошибка создания проекта';
          return { success: false, error: msg };
        }
      },

      updateProject: async (id, data) => {
        try {
          const updated = await projectService.updateProject(id, data);
          set(state => ({
            projects: state.projects.map(p => (p.id === id ? updated : p)),
            activeProject: state.activeProject?.id === id ? updated : state.activeProject,
          }));
          return { success: true };
        } catch (err) {
          return { success: false, error: err.response?.data?.detail || 'Ошибка обновления' };
        }
      },

      deleteProject: async (id) => {
        try {
          await projectService.deleteProject(id);
          set(state => ({
            projects: state.projects.filter(p => p.id !== id),
            activeProject: state.activeProject?.id === id ? null : state.activeProject,
          }));
          return { success: true };
        } catch (err) {
          return { success: false, error: err.response?.data?.detail || 'Ошибка удаления' };
        }
      },

      clearProjects: () => set({ projects: [], activeProject: null }),
    }),
    {
      name: 'project-storage',
      partialize: (state) => ({ activeProject: state.activeProject }),
    }
  )
);

export default useProjectStore;
