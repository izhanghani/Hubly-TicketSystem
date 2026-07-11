import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { showToast } from '../components/Toast.js';
import { escapeHtml, statusBadge, priorityBadge, formatDate, timeAgo, userAvatar } from '../utils.js';
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
            <div class="skeleton" style="height:500px;border-radius:var(--radius-xl)"></div>
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
      document.getElementById('ticket-detail').innerHTML = `<div class="error-page"><div class="error-icon error-icon-404"><i class="bi bi-exclamation-triangle"></i></div><h1>Error Loading Ticket</h1><p>${escapeHtml(err.message)}</p><div class="error-actions"><button class="btn btn-primary" onclick="location.reload()"><i class="bi bi-arrow-repeat"></i> Retry</button><a href="/tickets" data-link class="btn"><i class="bi bi-arrow-left"></i> Back to Tickets</a></div></div>`;
    }
  }

  renderSlaGauge(pct, status) {
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(pct, 100) / 100) * circumference;
    const colors = { ok: 'var(--success)', warning: 'var(--warning)', breached: 'var(--danger)' };
    const color = colors[status] || 'var(--primary)';
    return `
      <div class="sla-gauge">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle class="bg-circle" cx="40" cy="40" r="${radius}" />
          <circle class="progress-circle" cx="40" cy="40" r="${radius}"
            style="stroke:${color};stroke-dasharray:${circumference};stroke-dashoffset:${offset}" />
        </svg>
        <div class="gauge-text" style="color:${color}">${Math.round(pct)}%</div>
      </div>`;
  }

  renderTicket(user) {
    const t = this.ticket;
    Header.afterRender(user, `${t.ticket_number}: ${t.title}`);

    const isAgentOrAdmin = ['admin', 'supervisor', 'agent'].includes(user.role);
    const isSupervisorOrAdmin = ['admin', 'supervisor'].includes(user.role);
    const slaPct = this.getSLAPercentage();
    const slaClass = this.sla?.response_breached || this.sla?.resolution_breached ? 'breached' : (slaPct > 80 ? 'warning' : 'ok');
    const pendingRequest = this.assignmentRequests.find(r => r.status === 'pending');

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];

    document.getElementById('ticket-detail').innerHTML = `
      <div class="detail-header">
        <div class="detail-title">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
            <h1 style="font-size:20px">${escapeHtml(t.title)}</h1>
            ${t.is_private ? '<span class="status-badge badge-pending"><i class="bi bi-lock"></i> Private</span>' : ''}
          </div>
          <div class="meta">
            <span class="ticket-number">${escapeHtml(t.ticket_number)}</span>
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
          ${isAgentOrAdmin && t.status !== 'closed' && t.status !== 'cancelled' ? `<button class="btn btn-sm btn-outline-primary" onclick="window._editTicket()"><i class="bi bi-pencil"></i> Edit</button>` : ''}
          ${isAgentOrAdmin && t.status !== 'resolved' && t.status !== 'closed' && t.status !== 'cancelled' ? `<button class="btn btn-sm btn-success" onclick="window._resolveTicket()"><i class="bi bi-check-lg"></i> Resolve</button>` : ''}
          ${t.status === 'resolved' && (t.assignee_id === user.id || isSupervisorOrAdmin) ? `<button class="btn btn-sm btn-success" onclick="window._closeTicket()"><i class="bi bi-check2-all"></i> Close</button>` : ''}
          ${isAgentOrAdmin && t.status !== 'closed' && t.status !== 'cancelled' ? `<button class="btn btn-sm btn-danger" onclick="window._cancelTicket()"><i class="bi bi-x-lg"></i> Cancel</button>` : ''}
        </div>
      </div>

      ${this.sla ? `
      <div class="sla-bar ${slaClass}" style="display:flex;align-items:center;gap:16px">
        ${this.renderSlaGauge(slaPct, slaClass)}
        <div style="flex:1">
          <div class="sla-label">
            <span><i class="bi bi-clock-history"></i> <strong>Response:</strong> ${this.sla.first_response_at ? '<span style="color:var(--success)">Done</span>' : '<span style="color:var(--warning)">Pending</span>'} &middot; <strong>Resolution:</strong> ${this.sla.resolved_at ? '<span style="color:var(--success)">Done</span>' : '<span style="color:var(--warning)">Pending</span>'}</span>
            <span class="sla-status">${this.sla.response_breached ? '<span class="sla-breached"><i class="bi bi-exclamation-triangle-fill"></i> Response Breached!</span>' : ''} ${this.sla.resolution_breached ? '<span class="sla-breached"><i class="bi bi-exclamation-triangle-fill"></i> Resolution Breached!</span>' : ''}</span>
          </div>
          <div class="sla-track" style="margin-top:4px"><div class="sla-fill ${slaClass}" style="width:${Math.min(slaPct, 100)}%"></div></div>
        </div>
      </div>` : ''}

      ${pendingRequest ? `
      <div class="card" style="border-left:4px solid var(--warning);margin-bottom:20px;background:var(--warning-light);">
        <div class="card-body" style="padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div><i class="bi bi-hourglass-split" style="color:var(--warning);font-size:20px;margin-right:8px"></i>
          <strong>Assignment Request Pending</strong> - ${escapeHtml(pendingRequest.requester_name)} requested ${pendingRequest.agent_name ? escapeHtml(pendingRequest.agent_name) : 'any available agent'}
          ${pendingRequest.note ? ': ' + escapeHtml(pendingRequest.note) : ''}</div>
          ${isSupervisorOrAdmin ? `
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-sm btn-success" onclick="window._approveRequest(${pendingRequest.id})"><i class="bi bi-check"></i> Approve</button>
            <button class="btn btn-sm btn-danger" onclick="window._rejectRequest(${pendingRequest.id})"><i class="bi bi-x"></i> Reject</button>
          </div>` : ''}
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
            <div class="card-header"><h3 style="color:var(--success)"><i class="bi bi-check-circle"></i> Resolution Notes</h3></div>
            <div class="card-body" style="background:var(--success-light);border-radius:0 0 var(--radius-xl) var(--radius-xl)"><p style="white-space:pre-wrap">${escapeHtml(t.resolution_notes)}</p></div>
          </div>` : ''}

          ${this.attachments.length > 0 ? `
          <div class="card detail-section">
            <div class="card-header"><h3><i class="bi bi-paperclip"></i> Attachments (${this.attachments.length})</h3></div>
            <div class="card-body">
              <div class="attachments-grid">${this.attachments.map(a => {
                const ext = (a.original_name || '').split('.').pop()?.toLowerCase();
                const isImage = imageExts.includes(ext);
                const downloadUrl = `/api/tickets/${this.ticket.id}/attachments/${a.id}/download`;
                return isImage ? `
                  <div class="attachment-card" onclick="window.open('${downloadUrl}','_blank')">
                    <div class="attachment-preview"><img src="${downloadUrl}" alt="${escapeHtml(a.original_name)}" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'bi bi-file-earmark-image\\' style=\\'font-size:28px;color:var(--text-light)\\'>'" /></div>
                    <div class="attachment-info">
                      <span class="attachment-name">${escapeHtml(a.original_name)}</span>
                      <span class="attachment-size">${(a.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>` : `
                  <div class="attachment-card" onclick="window.open('${downloadUrl}','_blank')">
                    <div class="attachment-preview file-icon"><i class="bi bi-file-earmark"></i></div>
                    <div class="attachment-info">
                      <span class="attachment-name">${escapeHtml(a.original_name)}</span>
                      <span class="attachment-size">${(a.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>`;
              }).join('')}</div>
            </div>
          </div>` : ''}

          <div class="card detail-section">
            <div class="card-header"><h3><i class="bi bi-chat-dots"></i> Comments (${this.comments.length})</h3></div>
            <div class="card-body">
              ${this.comments.length === 0 ? '<div class="empty-state empty-state-sm" style="padding:20px"><i class="bi bi-chat-dots"></i><p>No comments yet. Be the first to respond.</p></div>' : ''}
              ${this.comments.map(c => `
              <div class="comment ${c.is_internal ? 'comment-internal' : ''}">
                <div class="comment-avatar">${userAvatar(c.user_name, c.user_avatar, 36)}</div>
                <div class="comment-body">
                  <div class="comment-header">
                    <span class="name">${escapeHtml(c.user_name)}</span>
                    <span class="time">${formatDate(c.created_at)}</span>
                    ${c.is_internal ? '<span class="internal-badge"><i class="bi bi-lock"></i> Internal</span>' : ''}
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
                    ${isAgentOrAdmin ? `<label class="toggle-sm"><input type="checkbox" id="comment-internal" /><span class="slider-sm"></span> Internal note</label>` : ''}
                  </div>
                </form>
              </div>` : '<div class="closed-comment-notice"><i class="bi bi-lock-fill"></i> This ticket is closed. Comments are disabled.</div>'}
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
                <div class="info-item"><div class="label">Type</div><div class="value">${t.type_name ? `<span style="color:${t.type_color}"><i class="bi bi-${t.type_icon || 'ticket'}"></i> ${escapeHtml(t.type_name)}</span>` : '-'}</div></div>
                <div class="info-item"><div class="label">Category</div><div class="value">${escapeHtml(t.category_name || '-')}</div></div>
                <div class="info-item"><div class="label">Department</div><div class="value">${escapeHtml(t.department_name || '-')}</div></div>
                <div class="info-item"><div class="label">Source</div><div class="value"><span class="source-badge">${t.source || 'web'}</span></div></div>
                <div class="info-item"><div class="label">Requester</div><div class="value"><div class="user-cell">${userAvatar(t.requester_full_name || t.requester_name, t.requester_avatar, 26)}<span>${escapeHtml(t.requester_full_name || t.requester_name || '-')}</span></div></div></div>
                <div class="info-item"><div class="label">Assignee</div><div class="value">${t.assignee_full_name || t.assignee_name ? `<div class="user-cell">${userAvatar(t.assignee_full_name || t.assignee_name, t.assignee_avatar, 26)}<span>${escapeHtml(t.assignee_full_name || t.assignee_name)}</span></div>` : '<span class="unassigned-badge">Unassigned</span>'}</div></div>
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
              <div class="timeline">${this.history.map(h => {
                const fieldIcons = { status: 'bi-flag', priority: 'bi-flag', assignee: 'bi-person', department: 'bi-building', type: 'bi-ticket', category: 'bi-tag', description: 'bi-card-text', title: 'bi-pencil' };
                const icon = fieldIcons[h.field_name?.toLowerCase()] || 'bi-arrow-right-circle';
                return `
                <div class="timeline-item">
                  <div class="timeline-icon" style="background:${this.getFieldColor(h.field_name)}"><i class="bi ${icon}"></i></div>
                  <div class="timeline-content">
                    <div class="timeline-header"><strong>${h.field_name}</strong> <span style="font-size:12px;color:var(--text-secondary)">by ${escapeHtml(h.user_name || 'System')}</span></div>
                    <div class="timeline-change"><span class="change-old">"${escapeHtml(h.old_value || 'empty')}"</span> <i class="bi bi-arrow-right" style="color:var(--text-light);font-size:12px"></i> <span class="change-new">"${escapeHtml(h.new_value || 'empty')}"</span></div>
                    <div class="timeline-time">${formatDate(h.created_at)}</div>
                  </div>
                </div>`;
              }).join('')}</div>
            </div>
          </div>` : ''}
        </div>
      </div>
    `;

    this.attachEventHandlers(user);
  }

  getFieldColor(field) {
    const colors = { status: 'var(--warning)', priority: 'var(--danger)', assignee: 'var(--success)', department: 'var(--info)', type: 'var(--purple)', category: 'var(--pink)', description: 'var(--primary)', title: 'var(--orange)' };
    return colors[field?.toLowerCase()] || 'var(--secondary)';
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
      const handler = async (e) => {
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
          if (internal) internal.checked = false;
          showToast('Comment added', 'success');
          await this.loadTicket(this.ticket.id, user);
        } catch (err) {
          showToast('Failed: ' + err.message, 'error');
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-send"></i> Post Comment';
        }
      };
      form.addEventListener('submit', handler);
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
    const colors = { resolve: 'var(--success)', close: 'var(--success)', cancel: 'var(--danger)' };
    const actionMsg = action === 'close' && this.ticket.assignee_name ? `This ticket will be closed by <strong>${escapeHtml(this.ticket.assignee_name)}</strong>` : '';
    openModal({
      title: `${labels[action]} Ticket`,
      content: `<div style="text-align:center;padding:10px"><i class="bi ${icons[action]}" style="font-size:48px;color:${colors[action]};margin-bottom:12px;display:block"></i>
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
