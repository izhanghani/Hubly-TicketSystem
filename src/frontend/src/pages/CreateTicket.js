import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { showToast } from '../components/Toast.js';
import { navigate } from '../router.js';

export default class CreateTicketPage {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 3;
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
            <div class="card" style="max-width:860px;margin:0 auto">
              <div class="card-header">
                <div>
                  <h2 style="font-size:18px">Create New Ticket</h2>
                  <div class="subtitle">Fill in the details below to submit a support request</div>
                </div>
              </div>
              <div class="card-body">
                <div class="step-indicator" id="step-indicator">
                  <div class="step-indicator-progress" id="step-progress" style="width:33.33%"></div>
                  <div class="step active" data-step="1">
                    <div class="step-number">1</div>
                    <span class="step-label">Details</span>
                  </div>
                  <div class="step" data-step="2">
                    <div class="step-number">2</div>
                    <span class="step-label">Assignment</span>
                  </div>
                  <div class="step" data-step="3">
                    <div class="step-number">3</div>
                    <span class="step-label">Review</span>
                  </div>
                </div>

                <form id="create-ticket-form">
                  <div id="step-1">
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
                    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
                      <button type="button" class="btn btn-primary" id="step-1-next"><i class="bi bi-arrow-right"></i> Next Step</button>
                    </div>
                  </div>

                  <div id="step-2" style="display:none">
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

                    <div style="display:flex;justify-content:space-between;gap:10px;margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
                      <button type="button" class="btn" id="step-2-back"><i class="bi bi-arrow-left"></i> Back</button>
                      <button type="button" class="btn btn-primary" id="step-2-next"><i class="bi bi-arrow-right"></i> Review & Submit</button>
                    </div>
                  </div>

                  <div id="step-3" style="display:none">
                    <div class="card" style="background:var(--bg);margin-bottom:18px">
                      <div class="card-body">
                        <h4 style="font-size:15px;margin-bottom:16px">Review Your Ticket</h4>
                        <div class="info-grid" id="review-info">
                          <div class="info-item"><div class="label">Title</div><div class="value" id="review-title"></div></div>
                          <div class="info-item"><div class="label">Type</div><div class="value" id="review-type"></div></div>
                          <div class="info-item"><div class="label">Category</div><div class="value" id="review-category"></div></div>
                          <div class="info-item"><div class="label">Priority</div><div class="value" id="review-priority"></div></div>
                          <div class="info-item"><div class="label">Department</div><div class="value" id="review-department"></div></div>
                          <div class="info-item"><div class="label">Assignee</div><div class="value" id="review-assignee"></div></div>
                        </div>
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
                          <div class="label" style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Description</div>
                          <p id="review-description" style="font-size:14px;line-height:1.6;white-space:pre-wrap"></p>
                        </div>
                        <div style="margin-top:12px">
                          <div class="label" style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Attachments</div>
                          <p id="review-attachments" style="font-size:13px;color:var(--text-secondary)">None</p>
                        </div>
                      </div>
                    </div>

                    <div style="display:flex;justify-content:space-between;gap:10px;margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
                      <button type="button" class="btn" id="step-3-back"><i class="bi bi-arrow-left"></i> Edit Details</button>
                      <button type="submit" class="btn btn-primary btn-lg" id="submit-btn" style="flex:1" title="Ctrl+Enter">
                        <i class="bi bi-send"></i> <span id="submit-text">Create Ticket</span>
                      </button>
                    </div>
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
    this.user = user;

    const titleInput = document.getElementById('ticket-title');
    if (titleInput) setTimeout(() => titleInput.focus(), 300);

    try {
      const [typesData, prios, depts, agents] = await Promise.all([
        api.getTypes().catch(() => ({ types: [], categories: [] })),
        api.getPriorities().catch(() => []),
        api.getDepartments().catch(() => []),
        api.getUsers({ limit: 100 }).catch(() => ({ users: [] }))
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
        o.value = p.id; o.textContent = `${p.name}${p.sla_response_minutes ? ` (${p.sla_response_minutes}m / ${p.sla_resolution_minutes}m)` : ''}`;
        prioSelect.appendChild(o);
      });

      const deptSelect = document.getElementById('ticket-department');
      depts.forEach(d => {
        const o = document.createElement('option');
        o.value = d.id; o.textContent = d.name;
        deptSelect.appendChild(o);
      });

      const agentSelect = document.getElementById('ticket-assignee');
      const agentData = agents.users || agents || [];
      agentData.filter(u => ['admin', 'agent', 'supervisor'].includes(u.role)).forEach(u => {
        const o = document.createElement('option');
        o.value = u.id; o.textContent = `${u.full_name} (${u.role})`;
        agentSelect.appendChild(o);
      });

      this.setupSteps(typesData, prios, depts);
      this.setupFileUpload();
      this.setupFormSubmission();
    } catch (err) {
      console.error('CreateTicket init error:', err);
      showToast('Failed to load form data. Please refresh.', 'error');
    }
  }

  setupSteps(typesData, prios, depts) {
    const goToStep = (step) => {
      this.currentStep = step;
      document.querySelectorAll('[id^="step-"]').forEach(el => {
        if (/^step-\d+$/.test(el.id)) {
          el.style.display = el.id === `step-${step}` ? '' : 'none';
        }
      });
      document.querySelectorAll('.step').forEach(s => {
        const sNum = parseInt(s.dataset.step);
        s.classList.remove('active', 'completed');
        if (sNum === step) s.classList.add('active');
        else if (sNum < step) s.classList.add('completed');
      });
      const progress = document.getElementById('step-progress');
      if (progress) progress.style.width = `${(step / this.totalSteps) * 100}%`;
    };

    const validateStep1 = () => {
      const title = document.getElementById('ticket-title').value.trim();
      const type = document.getElementById('ticket-type').value;
      if (!title) { showToast('Please enter a ticket title', 'warning'); return false; }
      if (!type) { showToast('Please select a ticket type', 'warning'); return false; }
      return true;
    };

    document.getElementById('step-1-next').addEventListener('click', () => {
      if (validateStep1()) goToStep(2);
    });

    document.getElementById('step-2-back').addEventListener('click', () => goToStep(1));
    document.getElementById('step-2-next').addEventListener('click', () => {
      this.previewReview(typesData, prios, depts);
      goToStep(3);
    });
    document.getElementById('step-3-back').addEventListener('click', () => goToStep(2));
  }

  previewReview(typesData, prios, depts) {
    const title = document.getElementById('ticket-title').value;
    const typeId = document.getElementById('ticket-type').value;
    const catId = document.getElementById('ticket-category').value;
    const prioId = document.getElementById('ticket-priority').value;
    const deptId = document.getElementById('ticket-department').value;
    const assigneeId = document.getElementById('ticket-assignee').value;

    const type = (typesData.types || []).find(t => t.id == typeId);
    const cat = (typesData.categories || []).find(c => c.id == catId);
    const prio = prios.find(p => p.id == prioId);
    const dept = depts.find(d => d.id == deptId);
    const assignee = document.getElementById('ticket-assignee').querySelector(`option[value="${assigneeId}"]`);

    document.getElementById('review-title').textContent = title || '-';
    document.getElementById('review-type').textContent = type ? type.name : '-';
    document.getElementById('review-category').textContent = cat ? cat.name : 'None';
    document.getElementById('review-priority').textContent = prio ? prio.name : 'Default';
    document.getElementById('review-department').textContent = dept ? dept.name : 'None';
    document.getElementById('review-assignee').textContent = assigneeId ? (assignee ? assignee.textContent : 'Specific agent') : 'Auto-assign';

    const desc = document.getElementById('ticket-description').value;
    document.getElementById('review-description').textContent = desc || 'No description provided';

    const fileInput = document.getElementById('ticket-attachments');
    const fileCount = fileInput?.files?.length || 0;
    document.getElementById('review-attachments').textContent = fileCount > 0 ? `${fileCount} file(s) selected` : 'None';
  }

  setupFileUpload() {
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

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change'));
    });
  }

  setupFormSubmission() {
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

        const agentId = document.getElementById('ticket-assignee').value;
        if (agentId) {
          data.assignee_id = parseInt(agentId);
        } else if (['admin', 'supervisor', 'agent'].includes(this.user.role)) {
          data.assignee_id = this.user.id;
        }
        const note = document.getElementById('ticket-assignment-note').value;
        if (note) data.assignment_note = note;

        const ticket = await api.createTicket(data);

        const fileInput = document.getElementById('ticket-attachments');
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
