import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { statusBadge, priorityBadge, timeAgo, escapeHtml, debounce, userAvatar } from '../utils.js';
import { showToast } from '../components/Toast.js';

export default class TicketListPage {
  constructor() {
    this.filters = { page: 1, limit: 25 };
    this.totalPages = 1;
    this.types = [];
    this.priorities = [];
    this.user = null;
    this.viewMode = localStorage.getItem('ticketViewMode') || 'table';
    this.selectedTickets = new Set();
  }

  cleanup() {
    if (this._cleanups) this._cleanups.forEach(fn => fn());
  }

  render() {
    return `
      <div class="app-layout">
        ${Sidebar.render('tickets')}
        <div class="main-content">
          ${Header.render()}
          <div class="page-content">
            <div class="page-title">
              <span>Tickets</span>
              <div class="page-title-actions">
                <div class="view-toggle" id="view-toggle">
                  <button class="${this.viewMode === 'table' ? 'active' : ''}" data-view="table" title="Table View"><i class="bi bi-table"></i></button>
                  <button class="${this.viewMode === 'kanban' ? 'active' : ''}" data-view="kanban" title="Kanban Board"><i class="bi bi-columns-gap"></i></button>
                </div>
                <a href="/tickets/new" data-link class="btn btn-primary btn-sm" title="Ctrl+N"><i class="bi bi-plus-lg"></i> New Ticket</a>
              </div>
            </div>

            <div class="filters-bar" id="filters-bar">
              <div style="display:flex;gap:8px;flex:1;flex-wrap:wrap">
                <div class="form-input-group" style="min-width:180px;flex:1">
                  <span class="input-addon"><i class="bi bi-search"></i></span>
                  <input class="form-input" id="filter-search" placeholder="Search tickets..." style="border:none" />
                </div>
                <select class="form-select" id="filter-status" style="min-width:120px">
                  <option value="">All Status</option>
                  <option value="open">Open</option><option value="in_progress">In Progress</option>
                  <option value="pending">Pending</option><option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <select class="form-select" id="filter-type" style="min-width:110px"><option value="">All Types</option></select>
                <select class="form-select" id="filter-priority" style="min-width:110px"><option value="">All Priority</option></select>
                <input class="form-input" id="filter-date-from" type="date" style="min-width:130px;width:auto" placeholder="From date" title="From date" />
                <input class="form-input" id="filter-date-to" type="date" style="min-width:130px;width:auto" placeholder="To date" title="To date" />
              </div>
              <div style="display:flex;gap:4px">
                <button class="btn btn-sm btn-ghost" id="btn-export" title="Export to CSV"><i class="bi bi-download"></i></button>
                <button class="btn btn-ghost btn-sm" id="filter-clear" title="Clear filters"><i class="bi bi-x-circle"></i></button>
              </div>
            </div>

            <div id="filter-chips" class="filter-chips"></div>

            <div class="bulk-bar" id="bulk-bar">
              <span class="count" id="bulk-count">0 selected</span>
              <button class="btn btn-sm btn-outline-primary" id="bulk-assign"><i class="bi bi-person-check"></i> Assign</button>
              <button class="btn btn-sm btn-success" id="bulk-resolve"><i class="bi bi-check-lg"></i> Resolve</button>
              <button class="btn btn-sm btn-danger" id="bulk-close"><i class="bi bi-x-lg"></i> Close</button>
              <button class="btn btn-sm btn-ghost" id="bulk-clear" style="margin-left:auto"><i class="bi bi-x"></i> Clear</button>
            </div>

            <div class="card" id="tickets-card">
              <div class="card-body" style="padding:0" id="tickets-table-container">
                <div class="skeleton" style="height:400px;margin:20px"></div>
              </div>
              <div class="pagination" id="pagination"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async afterRender(user) {
    this.user = user;
    Sidebar.afterRender(user);
    Header.afterRender(user, 'Tickets');

    this.setupViewToggle();
    await this.loadFilterOptions();

    const search = document.getElementById('filter-search');
    const status = document.getElementById('filter-status');
    const type = document.getElementById('filter-type');
    const priority = document.getElementById('filter-priority');
    const dateFrom = document.getElementById('filter-date-from');
    const dateTo = document.getElementById('filter-date-to');

    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.get('search')) { search.value = queryParams.get('search'); this.filters.search = queryParams.get('search'); }
    if (queryParams.get('status')) { status.value = queryParams.get('status'); this.filters.status = queryParams.get('status'); }

    const applyFilter = () => {
      this.filters.search = search.value;
      this.filters.status = status.value;
      this.filters.type = type.value;
      this.filters.priority = priority.value;
      this.filters.date_from = dateFrom.value;
      this.filters.date_to = dateTo.value;
      this.filters.page = 1;
      this.updateFilterChips();
      this.loadData();
    };

    const debouncedSearch = debounce(applyFilter, 400);
    search.addEventListener('input', debouncedSearch);
    status.addEventListener('change', applyFilter);
    type.addEventListener('change', applyFilter);
    priority.addEventListener('change', applyFilter);
    dateFrom.addEventListener('change', applyFilter);
    dateTo.addEventListener('change', applyFilter);

    document.getElementById('filter-clear').addEventListener('click', () => {
      search.value = '';
      status.value = '';
      type.value = '';
      priority.value = '';
      dateFrom.value = '';
      dateTo.value = '';
      applyFilter();
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      const params = {};
      if (search.value) params.search = search.value;
      if (status.value) params.status = status.value;
      if (type.value) params.type = type.value;
      if (priority.value) params.priority = priority.value;
      if (dateFrom.value) params.date_from = dateFrom.value;
      if (dateTo.value) params.date_to = dateTo.value;
      const url = api.exportTicketsCSV(params);
      window.open(url, '_blank');
      showToast('Downloading CSV...', 'info');
    });

    this.setupBulkActions();
    this.loadData();
  }

  setupViewToggle() {
    const toggle = document.getElementById('view-toggle');
    if (!toggle) return;
    toggle.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.viewMode = btn.dataset.view;
        localStorage.setItem('ticketViewMode', this.viewMode);
        toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadData();
      });
    });
  }

  updateFilterChips() {
    const container = document.getElementById('filter-chips');
    if (!container) return;
    const chips = [];
    if (this.filters.search) chips.push({ label: `Search: "${this.filters.search}"`, key: 'search' });
    if (this.filters.status) chips.push({ label: `Status: ${this.filters.status}`, key: 'status' });
    if (this.filters.type) {
      const t = this.types.find(t => t.id == this.filters.type);
      if (t) chips.push({ label: `Type: ${t.name}`, key: 'type' });
    }
    if (this.filters.priority) {
      const p = this.priorities.find(p => p.id == this.filters.priority);
      if (p) chips.push({ label: `Priority: ${p.name}`, key: 'priority' });
    }
    if (this.filters.date_from) chips.push({ label: `From: ${this.filters.date_from}`, key: 'date_from' });
    if (this.filters.date_to) chips.push({ label: `To: ${this.filters.date_to}`, key: 'date_to' });

    if (chips.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = chips.map(c => `
      <span class="filter-chip" data-key="${c.key}">
        ${c.label} <i class="bi bi-x"></i>
      </span>
    `).join('');

    container.querySelectorAll('.filter-chip').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.key;
        if (key === 'search') document.getElementById('filter-search').value = '';
        else if (key === 'status') document.getElementById('filter-status').value = '';
        else if (key === 'type') document.getElementById('filter-type').value = '';
        else if (key === 'priority') document.getElementById('filter-priority').value = '';
        else if (key === 'date_from') document.getElementById('filter-date-from').value = '';
        else if (key === 'date_to') document.getElementById('filter-date-to').value = '';
        document.getElementById('filter-clear').click();
      });
    });
  }

  setupBulkActions() {
    const bar = document.getElementById('bulk-bar');
    document.getElementById('bulk-clear').addEventListener('click', () => {
      this.selectedTickets.clear();
      this.updateBulkBar();
      document.querySelectorAll('.ticket-checkbox').forEach(cb => cb.checked = false);
    });

    document.getElementById('bulk-assign').addEventListener('click', () => this.bulkAction('assign'));
    document.getElementById('bulk-resolve').addEventListener('click', () => this.bulkAction('resolve'));
    document.getElementById('bulk-close').addEventListener('click', () => this.bulkAction('close'));
  }

  updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    const count = document.getElementById('bulk-count');
    if (this.selectedTickets.size === 0) {
      bar.classList.remove('show');
      return;
    }
    bar.classList.add('show');
    count.textContent = `${this.selectedTickets.size} selected`;
  }

  async bulkAction(action) {
    const ids = Array.from(this.selectedTickets);
    if (ids.length === 0) return;

    const labels = { assign: 'Assign', resolve: 'Resolve', close: 'Close' };
    if (!confirm(`Are you sure you want to ${action} ${ids.length} ticket(s)?`)) return;

    try {
      const promises = ids.map(id => api.updateTicket(id, { status: action === 'assign' ? undefined : action === 'resolve' ? 'resolved' : 'closed' }));
      await Promise.all(promises);
      showToast(`${ids.length} ticket(s) ${action}ed`, 'success');
      this.selectedTickets.clear();
      this.updateBulkBar();
      this.loadData();
    } catch (err) {
      showToast('Bulk action failed: ' + err.message, 'error');
    }
  }

  async loadFilterOptions() {
    try {
      const [typesData, prios] = await Promise.all([
        api.getTypes(),
        api.getPriorities()
      ]);
      this.types = typesData.types || [];
      this.priorities = prios || [];

      const typeSelect = document.getElementById('filter-type');
      this.types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id; opt.textContent = t.name;
        typeSelect.appendChild(opt);
      });

      const prioSelect = document.getElementById('filter-priority');
      this.priorities.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name;
        prioSelect.appendChild(opt);
      });
    } catch (_) {}
  }

  async loadData() {
    if (this.viewMode === 'kanban') {
      this.loadKanban();
    } else {
      this.loadTickets();
    }
  }

  async loadTickets() {
    try {
      const container = document.getElementById('tickets-table-container');
      container.innerHTML = '<div class="skeleton" style="height:400px;margin:20px"></div>';
      document.getElementById('pagination').innerHTML = '';

      const params = {};
      Object.entries(this.filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const data = await api.getTickets(params);

      this.totalPages = data.totalPages;

      if (data.tickets.length === 0) {
        const hasFilters = this.filters.search || this.filters.status || this.filters.type || this.filters.priority || this.filters.date_from || this.filters.date_to;
        container.innerHTML = hasFilters
          ? '<div class="empty-state"><i class="bi bi-funnel"></i><h3>No matching tickets</h3><p>Try adjusting your filters or <a href="#" id="clear-filters-link" style="color:var(--primary)">clear all filters</a>.</p></div>'
          : '<div class="empty-state"><i class="bi bi-ticket"></i><h3>No tickets yet</h3><p>Get started by creating your first support ticket.</p><a href="/tickets/new" data-link class="btn btn-primary"><i class="bi bi-plus-lg"></i> Create Ticket</a></div>';
        document.getElementById('pagination').innerHTML = '';
        const clearLink = document.getElementById('clear-filters-link');
        if (clearLink) {
          clearLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('filter-clear').click();
          });
        }
        return;
      }

      container.innerHTML = `
        <div class="table-container">
          <table><thead><tr>
            <th class="check-col"><input type="checkbox" id="select-all-checkbox" /></th>
            <th>ID</th><th>Title</th><th>Status</th><th>Priority</th><th>Requester</th><th>Assignee</th><th>Created</th><th>SLA</th>
          </tr></thead><tbody>
            ${data.tickets.map(t => {
              const slaBadge = t.response_breached || t.resolution_breached
                ? '<span style="color:var(--danger)" title="SLA Breached"><i class="bi bi-exclamation-triangle-fill"></i></span>'
                : '<span style="color:var(--success)" title="SLA OK"><i class="bi bi-check-circle-fill"></i></span>';
              const rowClass = t.response_breached || t.resolution_breached ? 'style="border-left:3px solid var(--danger)"' : '';
              const checked = this.selectedTickets.has(t.id) ? 'checked' : '';
              return `<tr ${rowClass}>
                <td class="check-col" onclick="event.stopPropagation()"><input type="checkbox" class="ticket-checkbox" data-id="${t.id}" ${checked} /></td>
                <td style="font-weight:600;font-size:13px;white-space:nowrap;cursor:pointer" onclick="appNavigate('/tickets/${t.id}')">${escapeHtml(t.ticket_number)}</td>
                <td style="cursor:pointer" onclick="appNavigate('/tickets/${t.id}')"><span style="font-weight:500">${escapeHtml(t.title)}</span></td>
                <td onclick="appNavigate('/tickets/${t.id}')">${statusBadge(t.status)}</td>
                <td onclick="appNavigate('/tickets/${t.id}')">${priorityBadge(t)}</td>
                <td style="font-size:13px" onclick="appNavigate('/tickets/${t.id}')">${escapeHtml(t.requester_name || '-')}</td>
                <td style="font-size:13px" onclick="appNavigate('/tickets/${t.id}')">${t.assignee_name ? `<span style="display:flex;align-items:center;gap:6px">${userAvatar(t.assignee_name, t.assignee_avatar, 22)}<span style="font-size:13px">${escapeHtml(t.assignee_name)}</span></span>` : '<span style="color:var(--text-light)">-</span>'}</td>
                <td style="font-size:12px;color:var(--text-secondary);white-space:nowrap" onclick="appNavigate('/tickets/${t.id}')">${timeAgo(t.created_at)}</td>
                <td style="text-align:center" onclick="appNavigate('/tickets/${t.id}')">${slaBadge}</td>
              </tr>`;
            }).join('')}
          </tbody></table>
        </div>`;

      const selectAll = document.getElementById('select-all-checkbox');
      if (selectAll) {
        selectAll.addEventListener('change', () => {
          document.querySelectorAll('.ticket-checkbox').forEach(cb => {
            cb.checked = selectAll.checked;
            if (selectAll.checked) this.selectedTickets.add(parseInt(cb.dataset.id));
            else this.selectedTickets.delete(parseInt(cb.dataset.id));
          });
          this.updateBulkBar();
        });
      }

      document.querySelectorAll('.ticket-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
          const id = parseInt(cb.dataset.id);
          if (cb.checked) this.selectedTickets.add(id);
          else this.selectedTickets.delete(id);
          this.updateBulkBar();
        });
      });

      this.renderPagination();
    } catch (err) {
      showToast('Failed to load tickets: ' + err.message, 'error');
    }
  }

  async loadKanban() {
    try {
      const container = document.getElementById('tickets-table-container');
      container.innerHTML = '<div class="skeleton" style="height:400px;margin:20px"></div>';
      document.getElementById('pagination').innerHTML = '';

      const params = {};
      Object.entries(this.filters).forEach(([k, v]) => { if (v) params[k] = v; });
      params.limit = 100;
      const data = await api.getTickets(params);
      const tickets = data.tickets || [];

      if (tickets.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="bi bi-columns-gap"></i><h3>No tickets to display</h3><p>Create a ticket to see it on the board.</p></div>';
        return;
      }

      const columns = [
        { status: 'open', label: 'Open', icon: 'bi-inbox', color: 'var(--warning)' },
        { status: 'in_progress', label: 'In Progress', icon: 'bi-hourglass-split', color: 'var(--primary)' },
        { status: 'pending', label: 'Pending', icon: 'bi-pause-circle', color: 'var(--purple)' },
        { status: 'resolved', label: 'Resolved', icon: 'bi-check-circle', color: 'var(--success)' },
        { status: 'closed', label: 'Closed', icon: 'bi-check2-all', color: 'var(--text-secondary)' },
      ];

      container.innerHTML = `<div class="kanban-board">${columns.map(col => {
        const colTickets = tickets.filter(t => t.status === col.status);
        return `
          <div class="kanban-column">
            <div class="kanban-column-header">
              <span><i class="bi ${col.icon}" style="color:${col.color}"></i> ${col.label}</span>
              <span class="badge" style="background:${col.color}20;color:${col.color};padding:2px 8px;border-radius:10px;font-size:11px">${colTickets.length}</span>
            </div>
            <div class="kanban-column-body">
              ${colTickets.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--text-light);font-size:13px">No tickets</div>' : ''}
              ${colTickets.map(t => {
                const prioColors = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#22c55e' };
                const pColor = prioColors[t.priority_name] || t.priority_color || '#94a3b8';
                return `
                  <div class="kanban-card" onclick="appNavigate('/tickets/${t.id}')">
                    <div class="kanban-card-title">${escapeHtml(t.title)}</div>
                    <div class="kanban-card-meta">
                      <span class="kanban-card-priority" style="background:${pColor}20;color:${pColor}">${t.priority_name || 'Normal'}</span>
                      <span>#${t.ticket_number}</span>
                    </div>
                    <div class="kanban-card-meta" style="margin-top:6px">
                      <span style="display:flex;align-items:center;gap:4px">${userAvatar(t.assignee_name || t.requester_name, t.assignee_avatar || t.requester_avatar, 18)}${escapeHtml(t.assignee_name || t.requester_name || '-')}</span>
                      <span>${timeAgo(t.created_at)}</span>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      }).join('')}</div>`;

    } catch (err) {
      showToast('Failed to load board: ' + err.message, 'error');
    }
  }

  renderPagination() {
    const el = document.getElementById('pagination');
    if (!el || this.totalPages <= 1) { if (el) el.innerHTML = ''; return; }

    const page = this.filters.page;
    let html = `<button ${page <= 1 ? 'disabled' : ''} onclick="window._ticketPage(${page - 1})"><i class="bi bi-chevron-left"></i> Prev</button>`;

    for (let i = Math.max(1, page - 2); i <= Math.min(this.totalPages, page + 2); i++) {
      html += `<button class="${i === page ? 'active' : ''}" onclick="window._ticketPage(${i})">${i}</button>`;
    }

    html += `<button ${page >= this.totalPages ? 'disabled' : ''} onclick="window._ticketPage(${page + 1})">Next <i class="bi bi-chevron-right"></i></button>`;
    html += `<span class="info">Page ${page} of ${this.totalPages}</span>`;

    el.innerHTML = html;
    window._ticketPage = (p) => {
      this.filters.page = p;
      this.loadData();
    };
  }
}
