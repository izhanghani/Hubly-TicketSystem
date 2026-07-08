import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { showToast } from '../components/Toast.js';
import { navigate } from '../router.js';

export default class CreateTicketPage {
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
            <div class="card" style="max-width:860px;margin:0 auto">
              <div class="card-header">
                <div>
                  <h2 style="font-size:18px">Create New Ticket</h2>
                  <div class="subtitle">Fill in the details below to submit a support request</div>
                </div>
              </div>
              <div class="card-body">
                <form id="create-ticket-form">
                  <div class="form-group">
                    <label class="form-label">Title <span class="required">*</span></label>
                    <input class="form-input" id="ticket-title" placeholder="e.g. Unable to access email client" required autofocus />
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">Type <span class="required">*</span></label>
                      <select class="form-select" id="ticket-type" required><option value="">Select type...</option></select>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Category</label>
                      <select class="form-select" id="ticket-category"><option value="">Select category...</option></select>
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">Priority</label>
                      <select class="form-select" id="ticket-priority"><option value="">Select priority...</option></select>
                      <div class="form-hint">SLA times depend on priority selection</div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Department</label>
                      <select class="form-select" id="ticket-department"><option value="">Select department...</option></select>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-textarea" id="ticket-description" placeholder="Provide detailed information about the issue, including steps to reproduce if applicable..." style="min-height:140px"></textarea>
                  </div>

                  <div class="card" style="border:1px dashed var(--border);background:var(--bg);margin-bottom:18px">
                    <div class="card-body" style="padding:16px">
                      <label class="form-label" style="margin-bottom:8px"><i class="bi bi-person-plus" style="color:var(--primary)"></i> Request Assignment (Optional)</label>
                      <div class="form-row">
                        <div class="form-group" style="margin-bottom:0">
                          <label class="form-label" style="font-size:12px">Assign to specific agent</label>
                          <select class="form-select" id="ticket-assignee"><option value="">Auto-assign / Any available agent</option></select>
                        </div>
                        <div class="form-group" style="margin-bottom:0">
                          <label class="form-label" style="font-size:12px">Priority note</label>
                          <input class="form-input" id="ticket-assignment-note" placeholder="Why this needs specific attention..." />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label"><i class="bi bi-paperclip"></i> Attachments</label>
                    <div class="file-drop-zone" id="file-drop-zone">
                      <i class="bi bi-cloud-arrow-up" style="font-size:32px;color:var(--text-light)"></i>
                      <p style="font-size:13px;color:var(--text-secondary);margin:8px 0">Drag & drop files here or click to browse</p>
                      <input type="file" class="form-input" id="ticket-attachments" multiple accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style="display:none" />
                      <button type="button" class="btn btn-sm" id="browse-files-btn">Browse Files</button>
                      <div id="file-list" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"></div>
                    </div>
                  </div>

                  <div style="display:flex;gap:10px;margin-top:28px;padding-top:20px;border-top:1px solid var(--border)">
                    <button type="submit" class="btn btn-primary btn-lg" id="submit-btn" style="flex:1">
                      <i class="bi bi-send"></i> <span id="submit-text">Create Ticket</span>
                    </button>
                    <a href="/tickets" data-link class="btn btn-lg">Cancel</a>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async afterRender(user) {
    Sidebar.afterRender(user);
    Header.afterRender(user, 'New Ticket');

    const [typesData, prios, depts, agents] = await Promise.all([
      api.getTypes(),
      api.getPriorities(),
      api.getDepartments(),
      api.getUsers({ limit: 100, role: 'agent' }).catch(() => api.getUsers({ limit: 100 }))
    ]);

    const typeSelect = document.getElementById('ticket-type');
    (typesData.types || []).forEach(t => {
      const o = document.createElement('option');
      o.value = t.id; o.textContent = t.name;
      typeSelect.appendChild(o);
    });

    const catSelect = document.getElementById('ticket-category');
    typeSelect.addEventListener('change', () => {
      const tid = parseInt(typeSelect.value);
      catSelect.innerHTML = '<option value="">Select category...</option>';
      (typesData.categories || []).filter(c => c.type_id === tid).forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.name;
        catSelect.appendChild(o);
      });
    });

    const prioSelect = document.getElementById('ticket-priority');
    prios.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = `${p.name} (${p.sla_response_minutes}m / ${p.sla_resolution_minutes}m)`;
      prioSelect.appendChild(o);
    });

    const deptSelect = document.getElementById('ticket-department');
    depts.forEach(d => {
      const o = document.createElement('option');
      o.value = d.id; o.textContent = d.name;
      deptSelect.appendChild(o);
    });

    const agentSelect = document.getElementById('ticket-assignee');
    (agents.users || agents || []).filter(u => ['admin', 'agent', 'supervisor'].includes(u.role)).forEach(u => {
      const o = document.createElement('option');
      o.value = u.id; o.textContent = `${u.full_name} (${u.role})`;
      agentSelect.appendChild(o);
    });

    const dropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('ticket-attachments');
    const fileList = document.getElementById('file-list');

    document.getElementById('browse-files-btn').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      fileList.innerHTML = '';
      Array.from(fileInput.files).forEach(f => {
        fileList.innerHTML += `<span class="attachment-item"><i class="bi bi-file-earmark"></i> ${f.name} <small style="color:var(--text-secondary)">(${(f.size / 1024).toFixed(1)} KB)</small></span>`;
      });
    });

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border)'; });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border)';
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change'));
    });

    const form = document.getElementById('create-ticket-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      const text = document.getElementById('submit-text');
      btn.disabled = true;
      text.textContent = 'Creating...';

      try {
        const data = {
          title: document.getElementById('ticket-title').value,
          description: document.getElementById('ticket-description').value,
          type_id: parseInt(document.getElementById('ticket-type').value) || null,
          category_id: parseInt(document.getElementById('ticket-category').value) || null,
          priority_id: parseInt(document.getElementById('ticket-priority').value) || null,
          department_id: parseInt(document.getElementById('ticket-department').value) || null
        };

        const ticket = await api.createTicket(data);

        const agentId = document.getElementById('ticket-assignee').value;
        const note = document.getElementById('ticket-assignment-note').value;
        if (agentId || note) {
          await api.requestAssignment(ticket.id, { agent_id: agentId ? parseInt(agentId) : null, note }).catch(() => {});
        }

        if (fileInput.files.length > 0) {
          const fd = new FormData();
          Array.from(fileInput.files).forEach(f => fd.append('files', f));
          await api.uploadAttachments(ticket.id, fd).catch(() => {});
        }

        showToast(`Ticket ${ticket.ticket_number} created!`, 'success');
        navigate(`/tickets/${ticket.id}`);
      } catch (err) {
        showToast('Failed: ' + err.message, 'error');
        btn.disabled = false;
        text.textContent = 'Create Ticket';
      }
    });
  }
}
