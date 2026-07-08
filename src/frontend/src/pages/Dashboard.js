import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { statusBadge, priorityBadge, timeAgo, formatDate, escapeHtml } from '../utils.js';
import { showToast } from '../components/Toast.js';

export default class DashboardPage {
  cleanup() {
    if (this._cleanups) this._cleanups.forEach(fn => fn());
  }

  render() {
    return `
      <div class="app-layout">
        ${Sidebar.render('dashboard')}
        <div class="main-content">
          ${Header.render()}
          <div class="page-content" id="dashboard-content">
            <div class="stats-grid" id="stats-grid">
              ${[1,2,3,4,5,6].map(() => '<div class="stat-card"><div class="stat-icon blue"><div class="skeleton" style="width:24px;height:24px;border-radius:50%"></div></div><div class="stat-info"><div class="skeleton" style="width:60px;height:28px;margin-bottom:4px"></div><div class="skeleton" style="width:80px;height:14px"></div></div></div>').join('')}
            </div>
            <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-bottom:24px">
              <div class="card">
                <div class="card-header"><h2>Recent Tickets</h2><a href="/tickets" data-link class="btn btn-sm">View All</a></div>
                <div class="card-body" id="recent-tickets"><div class="skeleton" style="height:200px"></div></div>
              </div>
              <div class="card">
                <div class="card-header"><h2>By Status</h2></div>
                <div class="card-body" id="status-chart"><div class="skeleton" style="height:200px"></div></div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
              <div class="card">
                <div class="card-header"><h2>Tickets by Priority</h2></div>
                <div class="card-body" id="priority-chart"><div class="skeleton" style="height:180px"></div></div>
              </div>
              <div class="card">
                <div class="card-header"><h2>Activity</h2></div>
                <div class="card-body" id="activity-feed"><div class="skeleton" style="height:180px"></div></div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr;gap:24px;margin-top:24px" id="agent-performance-section">
              <div class="card">
                <div class="card-header"><h2><i class="bi bi-trophy" style="color:var(--warning)"></i> Agent Performance</h2></div>
                <div class="card-body" id="agent-performance"><div class="skeleton" style="height:200px"></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  afterRender(user) {
    Sidebar.afterRender(user);
    Header.afterRender(user);
    this.loadStats(user);
  }

  async loadStats(user) {
    try {
      const stats = await api.getDashboardStats();
      const isAgentOrAdmin = ['admin', 'supervisor', 'agent'].includes(user.role);

      document.getElementById('stats-grid').innerHTML = `
        <div class="stat-card">
          <div class="stat-icon blue"><i class="bi bi-ticket-perforated"></i></div>
          <div class="stat-info"><div class="value">${stats.totalTickets}</div><div class="label">Total Tickets</div></div>
          <div class="stat-trend up">+12%</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow"><i class="bi bi-hourglass-split"></i></div>
          <div class="stat-info"><div class="value">${stats.openTickets}</div><div class="label">Open Tickets</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="bi bi-check-circle"></i></div>
          <div class="stat-info"><div class="value">${stats.resolvedTickets}</div><div class="label">Resolved / Closed</div></div>
        </div>
        ${isAgentOrAdmin ? `
        <div class="stat-card">
          <div class="stat-icon purple"><i class="bi bi-person-check"></i></div>
          <div class="stat-info"><div class="value">${stats.myTickets}</div><div class="label">My Assigned Tickets</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="bi bi-exclamation-triangle"></i></div>
          <div class="stat-info"><div class="value">${stats.breachedSLA}</div><div class="label">SLA Breached</div></div>
        </div>` : ''}
        <div class="stat-card">
          <div class="stat-icon cyan"><i class="bi bi-bar-chart"></i></div>
          <div class="stat-info"><div class="value">${stats.ticketsByPriority.reduce((a, b) => a + b.count, 0)}</div><div class="label">Active Tickets</div></div>
        </div>
      `;

      document.getElementById('recent-tickets').innerHTML = stats.recentTickets.length === 0
        ? '<div class="empty-state"><i class="bi bi-inbox"></i><h3>No tickets yet</h3><p>Create your first ticket to get started.</p><a href="/tickets/new" data-link class="btn btn-primary">Create Ticket</a></div>'
        : `<table><thead><tr><th>Ticket</th><th>Title</th><th>Status</th><th>Priority</th><th>Requester</th><th>Created</th></tr></thead><tbody>
          ${stats.recentTickets.map(t => `<tr onclick="appNavigate('/tickets/${t.id}')">
            <td style="font-weight:600;font-size:13px">${escapeHtml(t.ticket_number)}</td>
            <td>${escapeHtml(t.title)}</td>
            <td>${statusBadge(t.status)}</td>
            <td>${priorityBadge(t)}</td>
            <td>${escapeHtml(t.requester_name)}</td>
            <td style="font-size:13px;color:var(--text-secondary)">${timeAgo(t.created_at)}</td>
          </tr>`).join('')}
        </tbody></table>`;

      const statusTotal = stats.ticketsByStatus.reduce((a, b) => a + b.count, 0) || 1;
      document.getElementById('status-chart').innerHTML = stats.ticketsByStatus.length === 0
        ? '<div class="empty-state" style="padding:30px"><i class="bi bi-pie-chart"></i><p>No data</p></div>'
        : `<div style="display:flex;flex-direction:column;gap:14px">
          ${stats.ticketsByStatus.map(s => {
            const pct = Math.round(s.count / statusTotal * 100);
            const colors = { open: 'var(--warning)', in_progress: 'var(--primary)', resolved: 'var(--success)', closed: 'var(--text-secondary)', on_hold: 'var(--danger)' };
            return `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>${statusBadge(s.status)}</span><span style="font-weight:600">${s.count} (${pct}%)</span></div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${colors[s.status] || 'var(--primary)'}"></div></div></div>`;
          }).join('')}
        </div>`;

      const priorityTotal = stats.ticketsByPriority.reduce((a, b) => a + b.count, 0) || 1;
      document.getElementById('priority-chart').innerHTML = stats.ticketsByPriority.length === 0
        ? '<div class="empty-state" style="padding:30px"><i class="bi bi-bar-chart"></i><p>No data</p></div>'
        : `<div style="display:flex;flex-direction:column;gap:14px">
          ${stats.ticketsByPriority.map(p => {
            const pct = Math.round(p.count / priorityTotal * 100);
            return `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>${priorityBadge({ id: p.id, name: p.name, color: p.color, level: p.level })}</span><span style="font-weight:600">${p.count} (${pct}%)</span></div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${p.color || 'var(--primary)'}"></div></div></div>`;
          }).join('')}
        </div>`;

      if (isAgentOrAdmin) {
        this.loadAgentPerformance();
      }

      document.getElementById('activity-feed').innerHTML = (stats.recentActivity || []).length === 0
        ? '<div class="empty-state" style="padding:30px"><i class="bi bi-activity"></i><p>No recent activity</p></div>'
        : `<div style="display:flex;flex-direction:column;gap:8px">
          ${stats.recentActivity.slice(0, 10).map(a => `
            <div class="activity-item">
              <div class="activity-icon"><i class="bi ${a.icon || 'bi-arrow-right-circle'}"></i></div>
              <div class="activity-content">
                <div class="activity-text">${escapeHtml(a.text)}</div>
                <div class="activity-time">${timeAgo(a.created_at)}</div>
              </div>
            </div>
          `).join('')}
        </div>`;

    } catch (err) {
      showToast('Failed to load dashboard: ' + err.message, 'error');
    }
  }

  async loadAgentPerformance() {
    try {
      const agents = await api.getAgentPerformance();
      const section = document.getElementById('agent-performance-section');
      const container = document.getElementById('agent-performance');
      if (!section || !container) return;
      if (!agents || agents.length === 0) { section.style.display = 'none'; return; }
      section.style.display = '';

      const maxTickets = Math.max(...agents.map(a => a.assigned_tickets), 1);
      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">
          ${agents.map(a => `
            <div style="background:var(--bg);border-radius:12px;padding:16px;display:flex;align-items:center;gap:14px;border:1px solid var(--border)">
              <div class="user-avatar" style="width:40px;height:40px;font-size:16px;flex-shrink:0">${(a.full_name || '?')[0]}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:14px">${escapeHtml(a.full_name)}</div>
                <div style="display:flex;gap:12px;margin-top:6px;font-size:12px;color:var(--text-secondary)">
                  <span><i class="bi bi-ticket"></i> ${a.assigned_tickets}</span>
                  <span><i class="bi bi-check-circle" style="color:var(--success)"></i> ${a.resolved_tickets}</span>
                  ${a.breached_sla > 0 ? `<span><i class="bi bi-exclamation-triangle" style="color:var(--danger)"></i> ${a.breached_sla}</span>` : ''}
                </div>
                <div class="progress-bar" style="margin-top:8px;height:4px">
                  <div class="progress-fill" style="width:${(a.resolved_tickets / Math.max(a.assigned_tickets, 1)) * 100}%;background:var(--success)"></div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>`;
    } catch {}
  }
}
