import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { showToast } from '../components/Toast.js';
import { escapeHtml, statusBadge, priorityBadge, formatDate, timeAgo } from '../utils.js';
import { openModal, closeModal } from '../components/Modal.js';

export default class TicketDetailPage {
  constructor() {
    this.ticket = null;
    this.comments = [];
    this.attachments = [];
    this.history = [];
    this.sla = null;
    this.assignmentRequests = [];
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
          <div class="page-content" id="ticket-detail">
            <div class="skeleton" style="height:500px"></div>
          </div>
        </div>
      </div>
    `;
  }

  async afterRender(user, params) {
    Sidebar.afterRender(user);
    Header.afterRender(user, 'Loading...');
    const ticketId = params.id;
    if (ticketId) await this.loadTicket(ticketId, user);
  }

  async loadTicket(id, user) {
    try {
      const [data, requests] = await Promise.all([
        api.getTicket(id),
        api.getAssignmentRequests(id).catch(() => [])
      ]);
      this.ticket = data;
      this.comments = data.comments || [];
      this.attachments = data.attachments || [];
      this.history = data.history || [];
      this.sla = data.sla;
      this.assignmentRequests = requests || [];
      this.renderTicket(user);
    } catch (err) {
      document.getElementById('ticket-detail').innerHTML = `<div class="error-page"><h1>Error</h1><p>${escapeHtml(err.message)}</p><a href="/tickets" data-link class="btn">Back to Tickets</a></div>`;
    }
  }

  renderTicket(user) {
    const t = this.ticket;
    Header.afterRender(user, `${t.ticket_number}: ${t.title}`);

    const isAgentOrAdmin = ['admin', 'supervisor', 'agent'].includes(user.role);
    const isSupervisorOrAdmin = ['admin', 'supervisor'].includes(user.role);
    const slaPct = this.getSLAPercentage();
    const slaClass = this.sla?.response_breached || this.sla?.resolution_breached ? 'breached' : (slaPct > 80 ? 'warning' : 'ok');
    const pendingRequest = this.assignmentRequests.find(r => r.status === 'pending');

    document.getElementById('ticket-detail').innerHTML = `
      <div class="detail-header">
        <div class="detail-title">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
            <h1 style="font-size:20px">${escapeHtml(t.title)}</h1>
            ${t.is_private ? '<span class="status-badge badge-pending"><i class="bi bi-lock"></i> Private</span>' : ''}
          </div>
          <div class="meta">
            <span style="font-weight:700;font-size:14px;color:var(--primary)">${escapeHtml(t.ticket_number)}</span>
            <span class="sep">|</span>
            ${statusBadge(t.status)}
            ${priorityBadge(t)}
            <span class="sep">|</span>
            <span><i class="bi bi-person"></i> ${escapeHtml(t.requester_full_name || t.requester_name)}</span>
            <span class="sep">|</span>
            <span><i class="bi bi-clock"></i> ${timeAgo(t.created_at)}</span>
          </div>
        </div>
        <div class="detail-actions">
          ${isAgentOrAdmin && t.status !== 'closed' && t.status !== 'cancelled' ? `<button class="btn btn-sm" onclick="window._editTicket()"><i class="bi bi-pencil"></i> Edit</button>` : ''}
          ${isAgentOrAdmin && t.status !== 'resolved' && t.status !== 'closed' && t.status !== 'cancelled' ? `<button class="btn btn-sm btn-success" onclick="window._resolveTicket()"><i class="bi bi-check-lg"></i> Resolve</button>` : ''}
          ${t.status === 'resolved' && (t.assignee_id === user.id || isSupervisorOrAdmin) ? `<button class="btn btn-sm btn-success" onclick="window._closeTicket()"><i class="bi bi-check2-all"></i> Close Ticket</button>` : ''}
          ${isAgentOrAdmin && t.status !== 'closed' && t.status !== 'cancelled' ? `<button class="btn btn-sm btn-danger" onclick="window._cancelTicket()"><i class="bi bi-x-lg"></i> Cancel</button>` : ''}
        </div>
      </div>

      ${this.sla ? `
      <div class="sla-bar">
        <div class="sla-label">
          <span><strong>Response:</strong> ${this.sla.first_response_at ? '<span style="color:var(--success)">Done</span>' : '<span style="color:var(--warning)">Pending</span>'} &middot; <strong>Resolution:</strong> ${this.sla.resolved_at ? '<span style="color:var(--success)">Done</span>' : '<span style="color:var(--warning)">Pending</span>'}</span>
          <span class="sla-status">${this.sla.response_breached ? '<span style="color:var(--danger)"><i class="bi bi-exclamation-triangle-fill"></i> Response Breached!</span>' : ''} ${this.sla.resolution_breached ? '<span style="color:var(--danger)"><i class="bi bi-exclamation-triangle-fill"></i> Resolution Breached!</span>' : ''}</span>
        </div>
        <div class="sla-track"><div class="sla-fill ${slaClass}" style="width:${Math.min(slaPct, 100)}%"></div></div>
      </div>` : ''}

      ${pendingRequest ? `
      <div class="detail-section">
        <div class="card" style="border-left:4px solid var(--warning);margin-bottom:20px">
          <div class="card-body" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px">
            <div><i class="bi bi-hourglass-split" style="color:var(--warning);font-size:20px;margin-right:8px"></i>
            <strong>Assignment Request Pending</strong> - ${escapeHtml(pendingRequest.requester_name)} requested ${pendingRequest.agent_name ? escapeHtml(pendingRequest.agent_name) : 'any available agent'}
            ${pendingRequest.note ? ': ' + escapeHtml(pendingRequest.note) : ''}</div>
            ${isSupervisorOrAdmin ? `
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn-sm btn-success" onclick="window._approveRequest(${pendingRequest.id})"><i class="bi bi-check"></i> Approve</button>
              <button class="btn btn-sm btn-danger" onclick="window._rejectRequest(${pendingRequest.id})"><i class="bi bi-x"></i> Reject</button>
            </div>` : ''}
          </div>
        </div>
      </div>` : ''}

      <div class="detail-grid">
        <div>
          <div class="card detail-section">
            <div class="card-header"><h3><i class="bi bi-card-text"></i> Description</h3></div>
            <div class="card-body"><p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(t.description) || '<span style="color:var(--text-secondary);font-style:italic">No description provided</span>'}</p></div>
          </div>

          ${t.resolution_notes ? `
          <div class="card detail-section">
            <div class="card-header"><h3><i class="bi bi-check-circle" style="color:var(--success)"></i> Resolution Notes</h3></div>
            <div class="card-body" style="background:var(--success-light);border-radius:0 0 var(--radius-xl) var(--radius-xl)"><p style="white-space:pre-wrap">${escapeHtml(t.resolution_notes)}</p></div>
          </div>` : ''}

          ${this.attachments.length > 0 ? `
          <div class="card detail-section">
            <div class="card-header"><h3><i class="bi bi-paperclip"></i> Attachments (${this.attachments.length})</h3></div>
            <div class="card-body"><div class="attachment-list">${this.attachments.map(a => `
              <div class="attachment-item"><i class="bi bi-file-earmark"></i><span>${escapeHtml(a.original_name)}</span><span style="color:var(--text-secondary);font-size:12px">(${(a.size / 1024).toFixed(1)} KB)</span></div>`).join('')}
            </div></div>
          </div>` : ''}

          <div class="card detail-section">
            <div class="card-header"><h3><i class="bi bi-chat-dots"></i> Comments (${this.comments.length})</h3></div>
            <div class="card-body">
              ${this.comments.length === 0 ? '<p style="color:var(--text-secondary);padding:10px;text-align:center">No comments yet. Be the first to respond.</p>' : ''}
              ${this.comments.map(c => `
              <div class="comment">
                <div class="comment-avatar">${(c.user_name || '?')[0].toUpperCase()}</div>
                <div class="comment-body">
                  <div class="comment-header">
                    <span class="name">${escapeHtml(c.user_name)}</span>
                    <span class="time">${formatDate(c.created_at)}</span>
                    ${c.is_internal ? '<span class="internal-badge">Internal</span>' : ''}
                  </div>
                  <div class="comment-text">${escapeHtml(c.comment)}</div>
                </div>
              </div>`).join('')}

              ${t.status !== 'closed' && t.status !== 'cancelled' ? `
              <div style="margin-top:20px;padding-top:20px;border-top:2px solid var(--border)">
                <form id="comment-form">
                  <div class="form-group">
                    <textarea class="form-textarea" id="comment-text" placeholder="Write a comment..." style="min-height:80px" required></textarea>
                  </div>
                  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                    <button type="submit" class="btn btn-primary" id="comment-submit"><i class="bi bi-send"></i> Post Comment</button>
                    ${isAgentOrAdmin ? `<label class="toggle"><input type="checkbox" id="comment-internal" /><span class="slider"></span></label><span style="font-size:13px;color:var(--text-secondary)">Internal note (hidden from requester)</span>` : ''}
                  </div>
                </form>
              </div>` : '<p style="color:var(--text-secondary);text-align:center;margin-top:16px;padding:16px;background:var(--bg);border-radius:8px">This ticket is closed. Comments are disabled.</p>'}
            </div>
          </div>
        </div>

        <div>
          <div class="card detail-section">
            <div class="card-header"><h3><i class="bi bi-info-circle"></i> Details</h3></div>
            <div class="card-body">
              <div class="info-grid">
                <div class="info-item"><div class="label">Status</div><div class="value">${statusBadge(t.status)}</div></div>
                <div class="info-item"><div class="label">Priority</div><div class="value">${priorityBadge(t)}</div></div>
                <div class="info-item"><div class="label">Type</div><div class="value">${t.type_name ? `<span style="color:${t.type_color}">${escapeHtml(t.type_name)}</span>` : '-'}</div></div>
                <div class="info-item"><div class="label">Category</div><div class="value">${escapeHtml(t.category_name || '-')}</div></div>
                <div class="info-item"><div class="label">Department</div><div class="value">${escapeHtml(t.department_name || '-')}</div></div>
                <div class="info-item"><div class="label">Source</div><div class="value"><span class="badge badge-closed">${t.source || 'web'}</span></div></div>
                <div class="info-item"><div class="label">Requester</div><div class="value"><div style="display:flex;align-items:center;gap:6px"><div class="comment-avatar" style="width:24px;height:24px;font-size:10px">${(t.requester_full_name || t.requester_name || '?')[0]}</div>${escapeHtml(t.requester_full_name || t.requester_name || '-')}</div></div></div>
                <div class="info-item"><div class="label">Assignee</div><div class="value">${t.assignee_full_name || t.assignee_name ? `<div style="display:flex;align-items:center;gap:6px"><div class="comment-avatar" style="width:24px;height:24px;font-size:10px;background:var(--success)">${(t.assignee_full_name || t.assignee_name)[0]}</div>${escapeHtml(t.assignee_full_name || t.assignee_name)}</div>` : '<span style="color:var(--text-light)">Unassigned</span>'}</div></div>
                <div class="info-item"><div class="label">Created</div><div class="value" style="font-size:13px">${formatDate(t.created_at)}</div></div>
                <div class="info-item"><div class="label">Updated</div><div class="value" style="font-size:13px">${formatDate(t.updated_at)}</div></div>
                ${t.resolved_at ? `<div class="info-item"><div class="label">Resolved</div><div class="value" style="font-size:13px;color:var(--success)">${formatDate(t.resolved_at)}</div></div>` : ''}
                ${t.closed_at ? `<div class="info-item"><div class="label">Closed By</div><div class="value" style="font-size:13px">${escapeHtml(t.closed_by_name || t.closed_by || 'System')}</div></div>` : ''}
              </div>
            </div>
          </div>

          ${this.history.length > 0 ? `
          <div class="card detail-section">
            <div class="card-header"><h3><i class="bi bi-arrow-repeat"></i> History</h3></div>
            <div class="card-body">
              <div class="timeline">${this.history.map(h => `
                <div class="timeline-item">
                  <div class="time">${formatDate(h.created_at)}</div>
                  <div class="desc"><strong>${h.field_name}</strong> changed from <span style="color:var(--text-secondary)">"${escapeHtml(h.old_value || 'empty')}"</span> to <span style="color:var(--primary)">"${escapeHtml(h.new_value || 'empty')}"</span> <span style="font-size:12px;color:var(--text-secondary)">by ${escapeHtml(h.user_name || 'System')}</span></div>
                </div>`).join('')}
              </div>
            </div>
          </div>` : ''}
        </div>
      </div>
    `;

    this.attachEventHandlers(user);
  }

  getSLAPercentage() {
    if (!this.sla || this.sla.resolved_at) return 100;
    const created = new Date(this.ticket.created_at);
    const deadline = new Date(this.sla.resolution_deadline);
    const now = new Date();
    const total = deadline - created;
    const elapsed = now - created;
    return total > 0 ? (elapsed / total) * 100 : 100;
  }

  attachEventHandlers(user) {
    const form = document.getElementById('comment-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('comment-text');
        const internal = document.getElementById('comment-internal');
        const btn = document.getElementById('comment-submit');
        if (!text.value.trim()) return;

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';

        try {
          await api.addComment(this.ticket.id, { comment: text.value, is_internal: internal?.checked || false });
          text.value = '';
          showToast('Comment added', 'success');
          await this.loadTicket(this.ticket.id, user);
        } catch (err) {
          showToast('Failed: ' + err.message, 'error');
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-send"></i> Post Comment';
        }
      });
    }

    window._editTicket = () => this.showEditModal(user);
    window._resolveTicket = () => this.confirmAction('resolve', user);
    window._closeTicket = () => this.confirmAction('close', user);
    window._cancelTicket = () => this.confirmAction('cancel', user);
    window._approveRequest = (id) => this.handleAssignmentRequest(id, 'approved', user);
    window._rejectRequest = (id) => this.handleAssignmentRequest(id, 'rejected', user);
  }

  async handleAssignmentRequest(id, status, user) {
    try {
      await api.updateAssignmentRequest(id, { status });
      showToast(`Request ${status}`, 'success');
      await this.loadTicket(this.ticket.id, user);
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  }

  confirmAction(action, user) {
    const labels = { resolve: 'Resolve', close: 'Close', cancel: 'Cancel' };
    const icons = { resolve: 'bi-check-lg', close: 'bi-check2-all', cancel: 'bi-x-lg' };
    const actionMsg = action === 'close' && this.ticket.assignee_name ? `This ticket will be closed by <strong>${escapeHtml(this.ticket.assignee_name)}</strong>` : '';
    openModal({
      title: `${labels[action]} Ticket`,
      content: `<div style="text-align:center;padding:10px"><i class="bi ${icons[action]}" style="font-size:48px;color:${action === 'cancel' ? 'var(--danger)' : 'var(--success)'};margin-bottom:12px;display:block"></i>
        <p style="font-size:15px">Are you sure you want to <strong>${action}</strong> this ticket?</p>
        ${actionMsg ? `<p style="font-size:13px;color:var(--text-secondary);margin-top:8px">${actionMsg}</p>` : ''}
        ${action === 'resolve' ? `
        <div class="form-group" style="margin-top:16px;text-align:left">
          <label class="form-label">Resolution Notes</label>
          <textarea class="form-textarea" id="action-notes" placeholder="Describe how this was resolved..." style="min-height:80px"></textarea>
        </div>` : ''}</div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: labels[action], class: `btn ${action === 'cancel' ? 'btn-danger' : 'btn-success'}`, onclick: async () => {
          const statusMap = { resolve: 'resolved', close: 'closed', cancel: 'cancelled' };
          const notesEl = document.getElementById('action-notes');
          try {
            await api.updateTicket(this.ticket.id, { status: statusMap[action], resolution_notes: notesEl?.value || '' });
            closeModal();
            showToast(`Ticket ${labels[action]}d`, 'success');
            await this.loadTicket(this.ticket.id, user);
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });
  }

  showEditModal(user) {
    openModal({
      title: 'Edit Ticket',
      size: 'lg',
      content: `
        <div class="form-row">
          <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="edit-title" value="${escapeHtml(this.ticket.title)}" /></div>
          <div class="form-group"><label class="form-label">Status</label>
            <select class="form-select" id="edit-status">
              <option value="open" ${this.ticket.status === 'open' ? 'selected' : ''}>Open</option>
              <option value="in_progress" ${this.ticket.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="pending" ${this.ticket.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="resolved" ${this.ticket.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="edit-priority"></select></div>
          <div class="form-group"><label class="form-label">Type</label><select class="form-select" id="edit-type"></select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Assignee</label><select class="form-select" id="edit-assignee"><option value="">Unassigned</option></select></div>
          <div class="form-group"><label class="form-label">Department</label><select class="form-select" id="edit-department"><option value="">None</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="edit-description" style="min-height:80px">${escapeHtml(this.ticket.description || '')}</textarea></div>
        <div class="form-group"><label class="form-label">Resolution Notes</label><textarea class="form-textarea" id="edit-resolution" style="min-height:60px">${escapeHtml(this.ticket.resolution_notes || '')}</textarea></div>
      `,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Save Changes', class: 'btn btn-primary', onclick: async () => {
          const data = {
            title: document.getElementById('edit-title').value,
            status: document.getElementById('edit-status').value,
            priority_id: parseInt(document.getElementById('edit-priority').value) || null,
            type_id: parseInt(document.getElementById('edit-type').value) || null,
            assignee_id: parseInt(document.getElementById('edit-assignee').value) || null,
            department_id: parseInt(document.getElementById('edit-department').value) || null,
            description: document.getElementById('edit-description').value,
            resolution_notes: document.getElementById('edit-resolution').value
          };
          try {
            await api.updateTicket(this.ticket.id, data);
            closeModal();
            showToast('Ticket updated', 'success');
            await this.loadTicket(this.ticket.id, user);
          } catch (err) {
            showToast('Failed: ' + err.message, 'error');
          }
        }}
      ]
    }, 'lg');

    this.populateEditSelects();
  }

  async populateEditSelects() {
    try {
      const [prios, typesData, usersData, depts] = await Promise.all([
        api.getPriorities(),
        api.getTypes(),
        api.getUsers({ limit: 100 }),
        api.getDepartments()
      ]);

      const prioEl = document.getElementById('edit-priority');
      prios.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; if (p.id === this.ticket.priority_id) o.selected = true; prioEl.appendChild(o); });

      const typeEl = document.getElementById('edit-type');
      (typesData.types || []).forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; if (t.id === this.ticket.type_id) o.selected = true; typeEl.appendChild(o); });

      const asgnEl = document.getElementById('edit-assignee');
      (usersData.users || []).filter(u => ['admin', 'agent'].includes(u.role)).forEach(u => { const o = document.createElement('option'); o.value = u.id; o.textContent = u.full_name; if (u.id === this.ticket.assignee_id) o.selected = true; asgnEl.appendChild(o); });

      const deptEl = document.getElementById('edit-department');
      depts.forEach(d => { const o = document.createElement('option'); o.value = d.id; o.textContent = d.name; if (d.id === this.ticket.department_id) o.selected = true; deptEl.appendChild(o); });
    } catch (_) {}
  }
}
