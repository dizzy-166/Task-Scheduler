import api from './auth';

const chatService = {
  getMessages: (params)   => api.get('/chat/messages/', { params }).then(r => r.data),
  sendMessage: (payload)  => api.post('/chat/messages/', payload).then(r => r.data),
  getMembers:  ()         => api.get('/chat/members/').then(r => r.data),
  getNotifications: ()    => api.get('/notifications/').then(r => r.data),
  markRead:    (id)       => api.post(`/notifications/${id}/read/`),
  markAllRead: ()         => api.post('/notifications/read/'),
};

export default chatService;
