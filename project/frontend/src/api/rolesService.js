import api from './auth';

const rolesService = {
  // Все доступные разрешения (справочник)
  getPermissions: () =>
    api.get('/permissions/').then(r => Array.isArray(r.data) ? r.data : (r.data.results ?? [])),

  // Роли компании
  getRoles: (companyId) =>
    api.get(`/companies/${companyId}/roles/`).then(r => Array.isArray(r.data) ? r.data : (r.data.results ?? [])),

  createRole: (companyId, name) =>
    api.post(`/companies/${companyId}/roles/`, { name }).then(r => r.data),

  renameRole: (companyId, roleId, name) =>
    api.patch(`/companies/${companyId}/roles/${roleId}/`, { name }).then(r => r.data),

  deleteRole: (companyId, roleId) =>
    api.delete(`/companies/${companyId}/roles/${roleId}/`),

  setRolePermissions: (companyId, roleId, permissions) =>
    api.post(`/companies/${companyId}/roles/${roleId}/set_permissions/`, { permissions }).then(r => r.data),

  // Роли участника
  getMemberRoles: (companyId, userId) =>
    api.get(`/companies/${companyId}/members/${userId}/roles/`).then(r => r.data),

  assignRole: (companyId, userId, roleId) =>
    api.post(`/companies/${companyId}/members/${userId}/roles/${roleId}/`).then(r => r.data),

  removeRole: (companyId, userId, roleId) =>
    api.delete(`/companies/${companyId}/members/${userId}/roles/${roleId}/`),
};

export default rolesService;
