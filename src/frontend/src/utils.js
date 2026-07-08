export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

export function statusBadge(status) {
  const map = {
    open: 'badge-open',
    in_progress: 'badge-progress',
    pending: 'badge-pending',
    resolved: 'badge-resolved',
    closed: 'badge-closed',
    cancelled: 'badge-cancelled'
  };
  const labels = {
    open: 'Open',
    in_progress: 'In Progress',
    pending: 'Pending',
    resolved: 'Resolved',
    closed: 'Closed',
    cancelled: 'Cancelled'
  };
  return `<span class="status-badge ${map[status] || ''}">${labels[status] || status}</span>`;
}

export function priorityBadge(priority) {
  if (!priority) return '';
  const colors = { 'Critical': '#dc3545', 'High': '#fd7e14', 'Medium': '#ffc107', 'Low': '#28a745' };
  const bg = colors[priority.name] || priority.color || '#6c757d';
  return `<span class="priority-badge" style="background:${bg}20;color:${bg};border:1px solid ${bg}40">${priority.name}</span>`;
}

export function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML.replace(/'/g, '&#39;');
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function getUserRoleLabel(role) {
  const map = { admin: 'Administrator', agent: 'Support Agent', supervisor: 'Supervisor', user: 'User' };
  return map[role] || role;
}

export function getUserRoleBadge(role) {
  const colors = { admin: 'role-admin', agent: 'role-agent', supervisor: 'role-supervisor', user: 'role-user' };
  return `<span class="role-badge ${colors[role] || ''}">${getUserRoleLabel(role)}</span>`;
}
