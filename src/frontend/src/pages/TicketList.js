import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { statusBadge, priorityBadge, timeAgo, escapeHtml, debounce } from '../utils.js';
import { showToast } from '../components/Toast.js';

export default class TicketListPage {
  constructor() {
    this.filters = { page: 1, limit: 25 };
    this.totalPages = 1;
    this.types = [];
    this.priorities = [];
    this.user = null;
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
                <a href="/tickets/new" data-link class="btn btn-primary btn-sm"><i class="bi bi-plus-lg"></i> New Ticket</a>
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

            <div class="card">
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
      this.loadTickets();
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

    this.loadTickets();
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
        container.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><h3>No tickets found</h3><p>Try different filters or <a href="/tickets/new" data-link>create a new ticket</a>.</p></div>';
        document.getElementById('pagination').innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div class="table-container">
          <table><thead><tr>
            <th>ID</th><th>Title</th><th>Status</th><th>Priority</th><th>Requester</th><th>Assignee</th><th>Created</th><th>SLA</th>
          </tr></thead><tbody>
            ${data.tickets.map(t => {
              const slaBadge = t.response_breached || t.resolution_breached
                ? '<span style="color:var(--danger)" title="SLA Breached"><i class="bi bi-exclamation-triangle-fill"></i></span>'
                : '<span style="color:var(--success)" title="SLA OK"><i class="bi bi-check-circle-fill"></i></span>';
              const rowClass = t.response_breached || t.resolution_breached ? 'style="border-left:3px solid var(--danger)"' : '';
              return `<tr ${rowClass} onclick="appNavigate('/tickets/${t.id}')">
                <td style="font-weight:600;font-size:13px;white-space:nowrap">${escapeHtml(t.ticket_number)}</td>
                <td><span style="font-weight:500">${escapeHtml(t.title)}</span></td>
                <td>${statusBadge(t.status)}</td>
                <td>${priorityBadge(t)}</td>
                <td style="font-size:13px">${escapeHtml(t.requester_name || '-')}</td>
                <td style="font-size:13px">${t.assignee_name ? `<span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:var(--primary-light);color:var(--primary);font-size:10px;text-align:center;line-height:20px;font-weight:600">${t.assignee_name[0]}</span>${escapeHtml(t.assignee_name)}</span>` : '<span style="color:var(--text-light)">-</span>'}</td>
                <td style="font-size:12px;color:var(--text-secondary);white-space:nowrap">${timeAgo(t.created_at)}</td>
                <td style="text-align:center">${slaBadge}</td>
              </tr>`;
            }).join('')}
          </tbody></table>
        </div>`;

      this.renderPagination();
    } catch (err) {
      showToast('Failed to load tickets: ' + err.message, 'error');
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
      this.loadTickets();
    };
  }
}
