const API_BASE = '/api';

let authToken = localStorage.getItem('token');

const api = {
  setToken(token) {
    authToken = token;
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  },

  getToken() { return authToken; },

  async request(method, path, body = null, isFormData = false) {
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  del(path) { return this.request('DELETE', path); },
  upload(path, formData) { return this.request('POST', path, formData, true); },

  // Auth
  login(username, password) { return this.post('/auth/login', { username, password }); },
  getMe() { return this.get('/auth/me'); },
  updateProfile(data) { return this.put('/auth/me', data); },
  changePassword(current, next) { return this.put('/auth/change-password', { current_password: current, new_password: next }); },
  uploadAvatar(formData) { return this.upload('/auth/avatar', formData); },
  deleteAvatar() { return this.del('/auth/avatar'); },

  // Users
  getUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/users${q ? '?' + q : ''}`);
  },
  getUser(id) { return this.get(`/users/${id}`); },
  createUser(data) { return this.post('/users', data); },
  updateUser(id, data) { return this.put(`/users/${id}`, data); },
  deleteUser(id) { return this.del(`/users/${id}`); },
  getUserStats() { return this.get('/users/stats/summary'); },

  // Tickets
  getTickets(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/tickets${q ? '?' + q : ''}`);
  },
  getTicket(id) { return this.get(`/tickets/${id}`); },
  createTicket(data) { return this.post('/tickets', data); },
  updateTicket(id, data) { return this.put(`/tickets/${id}`, data); },
  addComment(id, data) { return this.post(`/tickets/${id}/comments`, data); },
  uploadAttachments(id, formData) { return this.upload(`/tickets/${id}/attachments`, formData); },
  getTicketStats() { return this.get('/tickets/stats/summary'); },

  // SLA
  getSLAPolicies() { return this.get('/sla/policies'); },
  createSLAPolicy(data) { return this.post('/sla/policies', data); },
  updateSLAPolicy(id, data) { return this.put(`/sla/policies/${id}`, data); },
  deleteSLAPolicy(id) { return this.del(`/sla/policies/${id}`); },
  getPriorities() { return this.get('/sla/priorities'); },
  createPriority(data) { return this.post('/sla/priorities', data); },
  updatePriority(id, data) { return this.put(`/sla/priorities/${id}`, data); },
  deletePriority(id) { return this.del(`/sla/priorities/${id}`); },

  // Settings
  getSettings() { return this.get('/settings'); },
  updateSettings(data) { return this.put('/settings', { settings: data }); },
  getDepartments() { return this.get('/settings/departments'); },
  createDepartment(data) { return this.post('/settings/departments', data); },
  updateDepartment(id, data) { return this.put(`/settings/departments/${id}`, data); },
  deleteDepartment(id) { return this.del(`/settings/departments/${id}`); },
  getTypes() { return this.get('/settings/types'); },
  createType(data) { return this.post('/settings/types', data); },
  updateType(id, data) { return this.put(`/settings/types/${id}`, data); },
  createCategory(data) { return this.post('/settings/categories', data); },
  updateCategory(id, data) { return this.put(`/settings/categories/${id}`, data); },
  uploadLogo(formData) { return this.upload('/settings/logo', formData); },
  getAuditLogs(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/settings/audit-logs${q ? '?' + q : ''}`);
  },

  // Assignment Requests
  requestAssignment(ticketId, data) { return this.post(`/tickets/${ticketId}/request-assignment`, data); },
  getAssignmentRequests(ticketId) { return this.get(`/tickets/${ticketId}/assignment-requests`); },
  updateAssignmentRequest(id, data) { return this.put(`/tickets/assignment-requests/${id}`, data); },

  // Notifications
  getNotifications() { return this.get('/notifications'); },
  markNotificationRead(id) { return this.put(`/notifications/${id}/read`); },
  markAllNotificationsRead() { return this.put('/notifications/read-all'); },
  getUnreadCount() { return this.get('/notifications/unread-count'); },

  // Export
  exportTicketsCSV(params = {}) {
    const q = new URLSearchParams(params).toString();
    return `${API_BASE}/tickets/export/csv${q ? '?' + q : ''}`;
  },

  // Workflow
  getWorkflowRules() { return this.get('/workflow/rules'); },
  createWorkflowRule(data) { return this.post('/workflow/rules', data); },
  updateWorkflowRule(id, data) { return this.put(`/workflow/rules/${id}`, data); },
  deleteWorkflowRule(id) { return this.del(`/workflow/rules/${id}`); },
  evaluateWorkflow(data) { return this.post('/workflow/evaluate', data); },

  // Dashboard
  getDashboardStats() { return this.get('/dashboard/stats'); },
  getAgentPerformance() { return this.get('/dashboard/agent-performance'); }
};

export default api;
