import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { statusBadge, priorityBadge, timeAgo, formatDate, escapeHtml, userAvatar } from '../utils.js';
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
            <div class="welcome-header" id="welcome-header">
              <div class="welcome-content">
                <div class="welcome-avatar" id="welcome-avatar"></div>
                <div>
                  <h1>Welcome back, <span id="dash-username">User</span></h1>
                  <p id="dash-greeting" class="page-desc" style="margin-bottom:0;color:rgba(255,255,255,0.7)">Here's what's happening with your support system.</p>
                </div>
              </div>
              <button class="welcome-dismiss" id="welcome-dismiss-btn" title="Dismiss" aria-label="Dismiss welcome banner"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="quick-actions" id="quick-actions">
              <a href="/tickets/new" data-link class="quick-action" style="--qa-delay:0.05s">
                <i class="bi bi-plus-circle" style="background:var(--primary-light);color:var(--primary)"></i>
                <div><div class="qa-title">New Ticket</div><div class="qa-sub">Create support request</div></div>
              </a>
              <a href="/tickets" data-link class="quick-action" style="--qa-delay:0.1s">
                <i class="bi bi-ticket-perforated" style="background:var(--success-light);color:var(--success)"></i>
                <div><div class="qa-title">View Tickets</div><div class="qa-sub">Browse all tickets</div></div>
              </a>
              <a href="/profile" data-link class="quick-action" style="--qa-delay:0.15s">
                <i class="bi bi-person-circle" style="background:var(--purple-light);color:var(--purple)"></i>
                <div><div class="qa-title">My Profile</div><div class="qa-sub">Update settings</div></div>
              </a>
              <a href="/settings" data-link class="quick-action" style="display:none;--qa-delay:0.2s" id="qa-settings">
                <i class="bi bi-gear" style="background:var(--warning-light);color:var(--warning)"></i>
                <div><div class="qa-title">Settings</div><div class="qa-sub">System configuration</div></div>
              </a>
            </div>
            <div class="stats-grid" id="stats-grid">
              ${[1,2,3,4,5,6].map(() => '<div class="stat-card"><div class="stat-icon blue"><div class="skeleton" style="width:24px;height:24px;border-radius:50%"></div></div><div class="stat-info"><div class="skeleton" style="width:60px;height:28px;margin-bottom:4px"></div><div class="skeleton" style="width:80px;height:14px"></div></div></div>').join('')}
            </div>
            <div class="dashboard-grid">
              <div class="card">
                <div class="card-header"><h2>Recent Tickets</h2><a href="/tickets" data-link class="btn btn-sm">View All</a></div>
                <div class="card-body" id="recent-tickets"><div class="skeleton" style="height:200px"></div></div>
              </div>
              <div class="card">
                <div class="card-header"><h2>By Status</h2></div>
                <div class="card-body" id="status-chart"><div class="skeleton" style="height:200px"></div></div>
              </div>
            </div>
            <div class="dashboard-grid">
              <div class="card">
                <div class="card-header"><h2>Tickets by Priority</h2></div>
                <div class="card-body" id="priority-chart"><div class="skeleton" style="height:180px"></div></div>
              </div>
              <div class="card">
                <div class="card-header"><h2>Activity</h2></div>
                <div class="card-body" id="activity-feed"><div class="skeleton" style="height:180px"></div></div>
              </div>
            </div>
            <div class="dashboard-grid" id="agent-performance-section">
              <div class="card">
                <div class="card-header"><h2><i class="bi bi-trophy" style="color:var(--warning)"></i> Agent Performance</h2></div>
                <div class="card-body" id="agent-performance"><div class="skeleton" style="height:200px"></div></div>
              </div>
              <div class="card">
                <div class="card-header">
                  <h2><i class="bi bi-graph-up-arrow" style="color:var(--primary)"></i> Weekly Trend</h2>
                  <label class="toggle-sm" id="perf-graph-toggle-wrap" style="display:none" title="Show/hide graph">
                    <input type="checkbox" id="perf-graph-toggle" checked />
                    <span class="slider-sm"></span>
                  </label>
                </div>
                <div class="card-body" id="perf-graph" style="padding:16px"><div class="skeleton" style="height:200px"></div></div>
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
    const nameEl = document.getElementById('dash-username');
    if (nameEl) nameEl.textContent = user.name || user.username || 'User';
    const welcomeAvatar = document.getElementById('welcome-avatar');
    if (welcomeAvatar) {
      if (user.avatar) {
        welcomeAvatar.innerHTML = `<img src="${user.avatar}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
      } else {
        welcomeAvatar.textContent = (user.full_name || user.username || 'U')[0].toUpperCase();
      }
    }
    const greetingEl = document.getElementById('dash-greeting');
    if (greetingEl) {
      const h = new Date().getHours();
      const timeGreeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
      greetingEl.textContent = `${timeGreeting} Here's what's happening with your support system.`;
    }
    const welcomeHeader = document.getElementById('welcome-header');
    if (welcomeHeader) {
      const seen = sessionStorage.getItem('welcome_banner_seen');
      if (seen) {
        welcomeHeader.style.display = 'none';
      } else {
        sessionStorage.setItem('welcome_banner_seen', '1');
        const quickDismiss = welcomeHeader.querySelector('.welcome-dismiss');
        if (quickDismiss) {
          quickDismiss.addEventListener('click', () => {
            clearTimeout(welcomeHeader._dismissTimer);
            welcomeHeader.style.transition = 'opacity 0.4s ease';
            welcomeHeader.style.opacity = '0';
            setTimeout(() => { welcomeHeader.style.display = 'none'; }, 400);
          });
        }
        welcomeHeader._dismissTimer = setTimeout(() => {
          welcomeHeader.style.transition = 'opacity 0.6s ease, max-height 0.6s ease, margin-bottom 0.6s ease';
          welcomeHeader.style.opacity = '0';
          welcomeHeader.style.maxHeight = '0';
          welcomeHeader.style.marginBottom = '0';
          welcomeHeader.style.overflow = 'hidden';
          welcomeHeader.style.padding = '0 24px';
          setTimeout(() => { welcomeHeader.style.display = 'none'; }, 600);
        }, 10000);
      }
    }

    const toggleWrap = document.getElementById('perf-graph-toggle-wrap');
    const toggle = document.getElementById('perf-graph-toggle');
    if (toggleWrap && user.role === 'admin') {
      toggleWrap.style.display = 'flex';
      const saved = localStorage.getItem('perf_graph_visible');
      if (saved === 'false') { toggle.checked = false; }
      toggle.addEventListener('change', () => {
        localStorage.setItem('perf_graph_visible', toggle.checked);
        const section = document.getElementById('perf-graph-section');
        if (section) section.style.display = toggle.checked ? '' : 'none';
      });
    }
    if (localStorage.getItem('perf_graph_visible') === 'false') {
      const section = document.getElementById('perf-graph-section');
      if (section) section.style.display = 'none';
    }

    this.loadStats(user);
  }

  async loadStats(user) {
    try {
      const stats = await api.getDashboardStats();
      const isAgentOrAdmin = ['admin', 'supervisor', 'agent'].includes(user.role);
      const qaSettings = document.getElementById('qa-settings');
      if (qaSettings) qaSettings.style.display = user.role === 'admin' ? '' : 'none';

      const statItems = [
        { icon: 'bi-ticket-perforated', color: 'blue', value: stats.totalTickets, label: 'Total Tickets', trend: '+12%' },
        { icon: 'bi-hourglass-split', color: 'yellow', value: stats.openTickets, label: 'Open Tickets' },
        { icon: 'bi-check-circle', color: 'green', value: stats.resolvedTickets, label: 'Resolved / Closed' },
      ];
      if (isAgentOrAdmin) {
        statItems.push({ icon: 'bi-person-check', color: 'purple', value: stats.myTickets, label: 'My Assigned Tickets' });
        statItems.push({ icon: 'bi-exclamation-triangle', color: 'red', value: stats.breachedSLA, label: 'SLA Breached' });
      }
      statItems.push({ icon: 'bi-bar-chart', color: 'cyan', value: stats.ticketsByPriority.reduce((a, b) => a + b.count, 0), label: 'Active Tickets' });

      document.getElementById('stats-grid').innerHTML = statItems.map(s => `
        <div class="stat-card ${s.color}">
          <div class="stat-icon ${s.color}"><i class="bi ${s.icon}"></i></div>
          <div class="stat-info">
            <div class="value"><span class="stat-count" data-target="${s.value}">0</span></div>
            <div class="label">${s.label}</div>
            ${s.trend ? `<div class="trend up"><i class="bi bi-arrow-up-short"></i>${s.trend}</div>` : ''}
          </div>
        </div>
      `).join('');

      document.querySelectorAll('.stat-count').forEach(el => {
        const target = parseInt(el.dataset.target);
        const duration = 800;
        const start = performance.now();
        const update = (now) => {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.floor(eased * target);
          if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
      });

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
            const colors = { open: 'var(--warning)', in_progress: 'var(--primary)', resolved: 'var(--success)', closed: 'var(--text-secondary)', on_hold: 'var(--danger)', pending: 'var(--purple)' };
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

      this.renderPerfGraph(stats);

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
              ${userAvatar(a.full_name, a.avatar, 40)}
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

  renderPerfGraph(stats) {
    const container = document.getElementById('perf-graph');
    if (!container) return;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const values = stats.dailyTrend || [12, 19, 8, 15, 22, 10, 14];
    const max = Math.max(...values, 1);

    const canvas = document.createElement('canvas');
    canvas.className = 'chart-canvas';
    canvas.width = container.clientWidth || 400;
    canvas.height = 220;
    container.innerHTML = '';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const pad = { top: 20, right: 20, bottom: 30, left: 30 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barWidth = Math.min(chartW / values.length * 0.6, 40);
    const gap = chartW / values.length;

    const isDark = document.body.classList.contains('dark-mode');
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const gradient = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
    const isDarkMode = document.body.classList.contains('dark-mode');
    gradient.addColorStop(0, isDarkMode ? 'rgba(129,140,248,0.4)' : 'rgba(99,102,241,0.3)');
    gradient.addColorStop(1, isDarkMode ? 'rgba(129,140,248,0.02)' : 'rgba(99,102,241,0.02)');

    const points = values.map((v, i) => ({
      x: pad.left + gap * i + gap / 2,
      y: pad.top + chartH - (v / max) * chartH
    }));

    ctx.beginPath();
    ctx.moveTo(points[0].x, pad.top + chartH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = isDarkMode ? '#818cf8' : '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isDarkMode ? '#818cf8' : '#6366f1';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = isDarkMode ? '#818cf8' : '#6366f1';
      ctx.fill();
    });

    ctx.fillStyle = textColor;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    values.forEach((v, i) => {
      const x = pad.left + gap * i + gap / 2;
      ctx.fillText(days[i], x, h - pad.bottom + 16);
    });

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((max / 4) * (4 - i));
      const y = pad.top + (chartH / 4) * i;
      ctx.fillStyle = textColor;
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(val, pad.left - 8, y);
    }

    points.forEach((p, i) => {
      ctx.fillStyle = isDarkMode ? '#e2e8f0' : '#0f172a';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(values[i], p.x, p.y - 10);
    });

    const resizeHandler = () => {
      this.renderPerfGraph(stats);
    };
    window.addEventListener('resize', resizeHandler);
    if (this._cleanups) this._cleanups.push(() => window.removeEventListener('resize', resizeHandler));

    const toggleWrap = document.getElementById('perf-graph-toggle-wrap');
    if (toggleWrap) toggleWrap.style.display = 'flex';
  }
}
