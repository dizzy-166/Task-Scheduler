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
  
  // Получить активных участников
  getMembers: (companyId) => api.get(`/companies/${companyId}/members/`),
  
  // Получить приглашенных участников
  getInvitedMembers: (companyId) => api.get(`/companies/${companyId}/invited/`),
  
  // Изменить роль участника
  changeMemberRole: (companyId, userId, role) => 
    api.post(`/companies/${companyId}/members/${userId}/change_role/`, { role }),
  
  // Удалить участника
  removeMember: (companyId, userId) => 
    api.post(`/companies/${companyId}/members/${userId}/remove/`),
  
  // Получить мои приглашения
  getMyInvites: () => api.get('/companies/invites/'),
  
  // Ответить на приглашение
  respondToInvite: (companyId, action) => 
    api.post(`/companies/${companyId}/respond/`, { action }),
};

export default companyAPI;