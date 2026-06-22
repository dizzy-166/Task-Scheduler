import api from './auth';

const companyAPI = {
  // Получить список компаний пользователя
  getMyCompanies: () => api.get('/companies/'),
  
  // Создать новую компанию
  createCompany: (data) => api.post('/companies/', data),
  
  // Получить детали компании
  getCompany: (id) => api.get(`/companies/${id}/`),
  
  // Обновить компанию
  updateCompany: (id, data) => api.patch(`/companies/${id}/`, data),
  
  // Удалить компанию
  deleteCompany: (id) => api.delete(`/companies/${id}/`),
  
  // Пригласить пользователя
  inviteMember: (companyId, data) => api.post(`/companies/${companyId}/invite/`, data),

  // Поиск пользователей для автокомплита приглашения
  searchUsers: (q) => api.get(`/users/search/?q=${encodeURIComponent(q)}`),
  
  // Получить активных участников
  getMembers: (companyId) => api.get(`/companies/${companyId}/members/`),
  
  // Получить приглашенных участников
  getInvitedMembers: (companyId) => api.get(`/companies/${companyId}/pending/`),
  
  // Изменить системную роль участника (member/admin)
  changeMemberRole: (companyId, userId, role) => 
    api.post(`/companies/${companyId}/members/${userId}/change_role/`, { role }),
  
  // Удалить участника
  removeMember: (companyId, userId) => 
    api.post(`/companies/${companyId}/members/${userId}/remove/`),
  
  // Эффективные права текущего пользователя в компании { role, permissions: [] }
  getMyPermissions: (companyId) =>
    api.get(`/companies/${companyId}/my_permissions/`).then(res => res.data),

  // Получить мои приглашения
  getMyInvites: () => api.get('/companies/invites/'),
  
  // Ответить на приглашение
  respondToInvite: (companyId, action) => 
    api.post(`/companies/${companyId}/respond/`, { action }),

  // ========== Методы для работы с кастомными ролями ==========
  
  // Получить все роли компании (включая кастомные)
  getRoles: (companyId) => 
    api.get(`/companies/${companyId}/roles/`).then(res => {
      const data = res.data;
      return data.results || data;
    }),
  
  // Создать новую кастомную роль
  createRole: (companyId, name) => 
    api.post(`/companies/${companyId}/roles/`, { name }).then(res => res.data),
  
  // Переименовать роль
  renameRole: (companyId, roleId, name) => 
    api.patch(`/companies/${companyId}/roles/${roleId}/`, { name }).then(res => res.data),
  
  // Удалить роль
  deleteRole: (companyId, roleId) => 
    api.delete(`/companies/${companyId}/roles/${roleId}/`),
  
  // Установить разрешения для роли
  setRolePermissions: (companyId, roleId, permissions) => 
    api.post(`/companies/${companyId}/roles/${roleId}/set_permissions/`, { permissions }).then(res => res.data),
  
  // Получить разрешения роли
  getRolePermissions: (companyId, roleId) => 
    api.get(`/companies/${companyId}/roles/${roleId}/`).then(res => {
      const data = res.data;
      return data.permissions || data;
    }),
  
  // ========== Методы для работы с ролями участников ==========
  
  // Получить все роли участника в компании
  getMemberRoles: (companyId, userId) => 
    api.get(`/companies/${companyId}/members/${userId}/roles/`).then(res => {
      const data = res.data;
      return data.results || data;
    }),
  
  // Назначить кастомную роль участнику
  assignRoleToMember: (companyId, userId, roleId) => 
    api.post(`/companies/${companyId}/members/${userId}/roles/${roleId}/`).then(res => res.data),
  
  // Снять кастомную роль с участника
  removeRoleFromMember: (companyId, userId, roleId) => 
    api.delete(`/companies/${companyId}/members/${userId}/roles/${roleId}/`),
  
  // Получить всех участников с их ролями (расширенная версия)
  getMembersWithRoles: async (companyId) => {
    const membersResponse = await companyAPI.getMembers(companyId);
    const members = membersResponse.data?.results || membersResponse.data || membersResponse;
    const membersArray = Array.isArray(members) ? members : [];
    
    // Загружаем роли для каждого участника
    const membersWithRoles = await Promise.all(
      membersArray.map(async (member) => {
        try {
          const rolesResponse = await companyAPI.getMemberRoles(companyId, member.user);
          const roles = Array.isArray(rolesResponse) ? rolesResponse : (rolesResponse.results || []);
          return { 
            ...member, 
            roles: roles.map(r => r.role || r)
          };
        } catch (err) {
          console.error(`Ошибка загрузки ролей для ${member.user}:`, err);
          return { ...member, roles: [] };
        }
      })
    );
    
    return membersWithRoles;
  },
};

export default companyAPI;