import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { showToast } from '../components/Toast.js';
import { escapeHtml, formatDate } from '../utils.js';
import { openModal, closeModal } from '../components/Modal.js';

export default class AdminSettingsPage {
  cleanup() {
    if (this._cleanups) this._cleanups.forEach(fn => fn());
  }

  render() {
    return `
      <div class="app-layout">
        ${Sidebar.render('settings')}
        <div class="main-content">
          ${Header.render()}
          <div class="page-content">
            <div class="tabs" id="settings-tabs">
              <button class="tab active" data-tab="general">General</button>
              <button class="tab" data-tab="workflow">Workflows</button>
              <button class="tab" data-tab="features">Features</button>
              <button class="tab" data-tab="sla">SLA & Priorities</button>
              <button class="tab" data-tab="types">Types & Categories</button>
              <button class="tab" data-tab="departments">Departments</button>
              <button class="tab" data-tab="branding">Branding</button>
              <button class="tab" data-tab="email">Email</button>
              <button class="tab" data-tab="ad">AD/LDAP</button>
              <button class="tab" data-tab="audit">Audit Logs</button>
              <button class="tab" data-tab="security">Security</button>
            </div>
            <div id="settings-content">
              <div class="skeleton" style="height:400px"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async afterRender(user) {
    Sidebar.afterRender(user);
    Header.afterRender(user, 'Settings');

    let currentTab = 'general';
    const tabs = document.querySelectorAll('[data-tab]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        this.loadTab(currentTab);
      });
    });

    this.loadTab(currentTab);
  }

  async loadTab(tab) {
    const container = document.getElementById('settings-content');
    container.innerHTML = '<div class="skeleton" style="height:400px"></div>';

    try {
      if (tab === 'general') await this.renderGeneral(container);
      else if (tab === 'workflow') await this.renderWorkflows(container);
      else if (tab === 'features') await this.renderFeatures(container);
      else if (tab === 'sla') await this.renderSLA(container);
      else if (tab === 'types') await this.renderTypes(container);
      else if (tab === 'departments') await this.renderDepartments(container);
      else if (tab === 'branding') await this.renderBranding(container);
      else if (tab === 'email') await this.renderEmail(container);
      else if (tab === 'ad') await this.renderAD(container);
      else if (tab === 'audit') await this.renderAuditLogs(container);
      else if (tab === 'security') await this.renderSecurity(container);
    } catch (err) {
      container.innerHTML = `<div class="error-page"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  async renderGeneral(container) {
    const settings = await api.getSettings();
    const general = settings.general || [];

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>General Settings</h2></div>
        <div class="card-body">
          <form id="general-form">
            ${general.map(s => `
              <div class="form-group">
                <label class="form-label">${escapeHtml(s.description || s.key)}</label>
                ${s.type === 'boolean' ? `
                  <label class="toggle"><input type="checkbox" id="setting-${s.key}" ${s.value ? 'checked' : ''} /><span class="slider"></span></label>
                ` : `
                  <input class="form-input" id="setting-${s.key}" value="${escapeHtml(String(s.value))}" />
                `}
              </div>
            `).join('')}
            <button type="submit" class="btn btn-primary">Save Settings</button>
          </form>
        </div>
      </div>
    `;

    const form = document.getElementById('general-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      general.forEach(s => {
        const el = document.getElementById(`setting-${s.key}`);
        data[s.key] = s.type === 'boolean' ? el.checked : el.value;
      });
      try {
        await api.updateSettings(data);
        showToast('Settings saved', 'success');
      } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    });
  }

  async renderFeatures(container) {
    const features = [
      { key: 'feature_self_registration', label: 'Allow User Registration', desc: 'Enable self-registration on login page', icon: 'bi-person-plus' },
      { key: 'feature_guest_tickets', label: 'Guest Ticket Creation', desc: 'Allow unauthenticated users to submit tickets', icon: 'bi-ticket' },
      { key: 'feature_auto_assign', label: 'Auto-Assign Tickets', desc: 'Automatically assign new tickets to available agents', icon: 'bi-diagram-3' },
      { key: 'feature_email_notify', label: 'Email Notifications', desc: 'Send email notifications for ticket updates', icon: 'bi-envelope' },
      { key: 'feature_sla_tracking', label: 'SLA Enforcement', desc: 'Track and enforce SLA response/resolution times', icon: 'bi-clock' },
      { key: 'feature_maintenance_mode', label: 'Maintenance Mode', desc: 'Show maintenance page to all non-admin users', icon: 'bi-tools' },
      { key: 'feature_export', label: 'Allow Data Export', desc: 'Enable CSV/PDF export of tickets and reports', icon: 'bi-download' },
      { key: 'feature_public_faq', label: 'Public FAQ', desc: 'Show public FAQ page for guests', icon: 'bi-question-circle' },
      { key: 'feature_realtime', label: 'Real-Time Updates', desc: 'Enable WebSocket for live ticket updates', icon: 'bi-broadcast' },
      { key: 'feature_ratings', label: 'Ticket Ratings', desc: 'Allow requesters to rate resolved tickets', icon: 'bi-star' },
      { key: 'feature_knowledge_base', label: 'Knowledge Base', desc: 'Enable internal knowledge base', icon: 'bi-book' },
      { key: 'feature_reports', label: 'Reports & Analytics', desc: 'Enable reporting and analytics dashboard', icon: 'bi-bar-chart' },
    ];

    const settings = await api.getSettings();
    const current = {};
    (settings.features || []).forEach(f => { current[f.key] = f.value; });

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>Feature Management</h2></div>
        <div class="card-body">
          <form id="features-form">
            <div class="features-grid">
              ${features.map(f => `
                <div class="feature-card">
                  <div class="feature-icon"><i class="bi ${f.icon}"></i></div>
                  <div class="feature-info">
                    <div class="feature-name">${escapeHtml(f.label)}</div>
                    <div class="feature-desc">${escapeHtml(f.desc)}</div>
                  </div>
                  <label class="toggle toggle-lg">
                    <input type="checkbox" id="feature-${f.key}" ${current[f.key] === true || current[f.key] === 'true' ? 'checked' : ''} />
                    <span class="slider"></span>
                  </label>
                </div>
              `).join('')}
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:20px">Save Features</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('features-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      features.forEach(f => {
        data[f.key] = document.getElementById(`feature-${f.key}`).checked;
      });
      try {
        await api.updateSettings(data);
        if (data.feature_maintenance_mode !== undefined) {
          await api.put('/config', { maintenance: data.feature_maintenance_mode });
        }
        showToast('Features saved', 'success');
      } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    });
  }

  async renderSLA(container) {
    const [policies, priorities, typesData] = await Promise.all([
      api.getSLAPolicies(),
      api.getPriorities(),
      api.getTypes()
    ]);
    const ticketTypes = typesData?.types || [];
    this._ticketTypes = ticketTypes;

    container.innerHTML = `
      <div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <h2>Priorities</h2>
          <button class="btn btn-sm btn-primary" onclick="window._addPriority()"><i class="bi bi-plus"></i> Add Priority</button>
        </div>
        <div class="card-body" style="padding:0">
          <table><thead><tr><th>Name</th><th>Level</th><th>Color</th><th>SLA Response</th><th>SLA Resolution</th><th>Status</th><th></th></tr></thead>
          <tbody>${priorities.map(p => `<tr>
            <td><span style="font-weight:500">${escapeHtml(p.name)}</span></td>
            <td><span class="status-badge badge-closed" style="font-size:11px;padding:2px 10px">Lvl ${p.level}</span></td>
            <td><span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:${p.color};vertical-align:middle"></span> ${p.color}</td>
            <td>${p.sla_response_minutes}m</td>
            <td>${p.sla_resolution_minutes}m</td>
            <td>${p.is_active ? '<span class="status-badge badge-resolved" style="font-size:11px;padding:2px 10px">Active</span>' : '<span class="status-badge badge-cancelled" style="font-size:11px;padding:2px 10px">Inactive</span>'}</td>
            <td><button class="btn btn-sm btn-ghost" onclick="window._editPriority(${p.id})"><i class="bi bi-pencil"></i></button></td>
          </tr>`).join('')}</tbody></table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>SLA Policies</h2>
          <button class="btn btn-sm btn-primary" onclick="window._addSLAPolicy()"><i class="bi bi-plus"></i> Add Policy</button>
        </div>
        <div class="card-body" style="padding:0">
          <table><thead><tr><th>Name</th><th>Priority</th><th>Requester Role</th><th>Ticket Type</th><th>Response</th><th>Resolution</th><th>Biz Hours</th><th>Status</th><th></th></tr></thead>
          <tbody>${policies.map(p => {
            const roleLabels = { admin: 'Admin', agent: 'Agent', supervisor: 'Supervisor', user: 'User', '': 'Any' };
            const typeName = ticketTypes.find(t => t.id === p.ticket_type_id)?.name || '-';
            return `<tr>
            <td><span style="font-weight:500">${escapeHtml(p.name)}</span></td>
            <td><span class="priority-badge" style="background:${p.priority_color}20;color:${p.priority_color}">${escapeHtml(p.priority_name)}</span></td>
            <td style="font-size:13px">${roleLabels[p.requester_role] || 'Any'}</td>
            <td style="font-size:13px">${escapeHtml(typeName)}</td>
            <td>${p.response_time_minutes}m</td>
            <td>${p.resolution_time_minutes}m</td>
            <td>${p.business_hours_only ? '<i class="bi bi-clock" style="color:var(--success)"></i>' : '<i class="bi bi-clock" style="color:var(--warning)"></i>'}</td>
            <td>${p.is_active ? '<span class="status-badge badge-resolved" style="font-size:11px;padding:2px 10px">Active</span>' : '<span class="status-badge badge-cancelled" style="font-size:11px;padding:2px 10px">Inactive</span>'}</td>
            <td><button class="btn btn-sm btn-ghost" onclick="window._editSLAPolicy(${p.id})"><i class="bi bi-pencil"></i></button></td>
          </tr>`;
          }).join('')}</tbody></table>
        </div>
      </div>
    `;

    window._addPriority = () => this.addPriority();
    window._editPriority = (id) => this.editPriority(id, priorities);
    window._addSLAPolicy = () => this.addSLAPolicy(priorities, ticketTypes);
    window._editSLAPolicy = (id) => this.editSLAPolicy(id, policies, priorities, ticketTypes);
  }

  async renderTypes(container) {
    const data = await api.getTypes();

    container.innerHTML = `
      <div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <h2>Ticket Types</h2>
          <button class="btn btn-sm btn-primary" onclick="window._addType()"><i class="bi bi-plus"></i> Add Type</button>
        </div>
        <div class="card-body" style="padding:0">
          <table><thead><tr><th>Name</th><th>Icon</th><th>Color</th><th>Description</th><th>Status</th><th></th></tr></thead>
          <tbody>${(data.types || []).map(t => `<tr>
            <td><span style="font-weight:500">${escapeHtml(t.name)}</span></td>
            <td><i class="bi bi-${t.icon || 'ticket'}"></i></td>
            <td><span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:${t.color};vertical-align:middle"></span></td>
            <td style="font-size:13px;color:var(--text-secondary)">${escapeHtml(t.description || '')}</td>
            <td>${t.is_active ? '<span class="status-badge badge-resolved" style="font-size:11px;padding:2px 10px">Active</span>' : '<span class="status-badge badge-cancelled" style="font-size:11px;padding:2px 10px">Inactive</span>'}</td>
            <td><button class="btn btn-sm btn-ghost" onclick="window._editType(${t.id})"><i class="bi bi-pencil"></i></button></td>
          </tr>`).join('')}</tbody></table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>Categories</h2>
          <button class="btn btn-sm btn-primary" onclick="window._addCategory()"><i class="bi bi-plus"></i> Add Category</button>
        </div>
        <div class="card-body" style="padding:0">
          <table><thead><tr><th>Name</th><th>Type</th><th>Description</th><th>Status</th><th></th></tr></thead>
          <tbody>${(data.categories || []).map(c => {
            const typeName = (data.types || []).find(t => t.id === c.type_id)?.name || 'Unknown';
            return `<tr>
              <td>${escapeHtml(c.name)}</td>
              <td><span style="font-size:13px">${escapeHtml(typeName)}</span></td>
              <td style="font-size:13px;color:var(--text-secondary)">${escapeHtml(c.description || '')}</td>
              <td>${c.is_active ? '<span class="status-badge badge-resolved" style="font-size:11px;padding:2px 10px">Active</span>' : '<span class="status-badge badge-cancelled" style="font-size:11px;padding:2px 10px">Inactive</span>'}</td>
              <td><button class="btn btn-sm btn-ghost" onclick="window._editCategory(${c.id})"><i class="bi bi-pencil"></i></button></td>
            </tr>`;
          }).join('')}</tbody></table>
        </div>
      </div>
    `;

    window._addType = () => this.addType();
    window._editType = (id) => this.editType(id, data.types);
    window._addCategory = () => this.addCategory(data);
    window._editCategory = (id) => this.editCategory(id, data);
  }

  async renderDepartments(container) {
    const depts = await api.getDepartments();

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Departments</h2>
          <button class="btn btn-sm btn-primary" onclick="window._addDept()"><i class="bi bi-plus"></i> Add</button>
        </div>
        <div class="card-body" style="padding:0">
          <table><thead><tr><th>Name</th><th>Description</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>${depts.map(d => `<tr>
            <td style="font-weight:500">${escapeHtml(d.name)}</td>
            <td style="color:var(--text-secondary)">${escapeHtml(d.description || '-')}</td>
            <td style="font-size:13px;color:var(--text-secondary)">${formatDate(d.created_at)}</td>
            <td><button class="btn btn-sm btn-ghost" onclick="window._editDept(${d.id}, '${escapeHtml(d.name)}', '${escapeHtml(d.description || '')}')"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-ghost text-danger" onclick="window._delDept(${d.id})"><i class="bi bi-trash"></i></button></td>
          </tr>`).join('')}</tbody></table>
        </div>
      </div>
    `;

    window._addDept = () => {
      openModal({
        title: 'Add Department',
        content: `<div class="form-group"><label class="form-label">Name</label><input class="form-input" id="dept-name" /></div>
          <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="dept-desc" /></div>`,
        buttons: [
          { text: 'Cancel', class: 'btn', onclick: closeModal },
          { text: 'Create', class: 'btn btn-primary', onclick: async () => {
            try {
              await api.createDepartment({ name: document.getElementById('dept-name').value, description: document.getElementById('dept-desc').value });
              closeModal(); showToast('Department created', 'success');
              this.loadTab('departments');
            } catch (err) { showToast('Failed: ' + err.message, 'error'); }
          }}
        ]
      });
    };

    window._editDept = (id, name, desc) => {
      openModal({
        title: 'Edit Department',
        content: `<div class="form-group"><label class="form-label">Name</label><input class="form-input" id="dept-name" value="${name}" /></div>
          <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="dept-desc" value="${desc}" /></div>`,
        buttons: [
          { text: 'Cancel', class: 'btn', onclick: closeModal },
          { text: 'Save', class: 'btn btn-primary', onclick: async () => {
            try {
              await api.updateDepartment(id, { name: document.getElementById('dept-name').value, description: document.getElementById('dept-desc').value });
              closeModal(); showToast('Department updated', 'success');
              this.loadTab('departments');
            } catch (err) { showToast('Failed: ' + err.message, 'error'); }
          }}
        ]
      });
    };

    window._delDept = (id) => {
      if (!confirm('Delete this department?')) return;
      api.deleteDepartment(id).then(() => { showToast('Department deleted', 'success'); this.loadTab('departments'); })
        .catch(err => showToast('Failed: ' + err.message, 'error'));
    };
  }

  async renderBranding(container) {
    const [settings, themeData] = await Promise.all([
      api.getSettings(),
      api.get('/settings')
    ]);
    const brand = {};
    (settings.branding || []).forEach(s => { brand[s.key] = s.value; });
    const theme = {};
    (themeData.theme || []).forEach(s => { theme[s.key] = s.value; });

    container.innerHTML = `
      <div class="card" style="max-width:600px;margin-bottom:24px">
        <div class="card-header"><h2>Company Branding</h2></div>
        <div class="card-body">
          <form id="branding-form">
            <div class="form-group">
              <label class="form-label">Company Name</label>
              <input class="form-input" id="brand-company-name" value="${escapeHtml(brand.branding_company_name || 'Hubly')}" />
            </div>
            <div class="form-group">
              <label class="form-label">System Tagline</label>
              <input class="form-input" id="brand-tagline" value="${escapeHtml(brand.branding_tagline || 'Professional IT Ticket Management')}" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Primary Color</label>
                <input class="form-input" id="brand-primary-color" type="color" value="${brand.branding_primary_color || '#2563eb'}" />
              </div>
              <div class="form-group">
                <label class="form-label">Secondary Color</label>
                <input class="form-input" id="brand-secondary-color" type="color" value="${brand.branding_secondary_color || '#64748b'}" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Sidebar Color</label>
                <input class="form-input" id="brand-sidebar-color" type="color" value="${theme.theme_sidebar_color || '#0f172a'}" />
              </div>
              <div class="form-group">
                <label class="form-label">Accent Color</label>
                <input class="form-input" id="brand-accent-color" type="color" value="${theme.theme_accent_color || '#8b5cf6'}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Footer Text</label>
              <input class="form-input" id="brand-footer-text" value="${escapeHtml(brand.branding_footer_text || 'Hubly')}" />
            </div>
            <button type="submit" class="btn btn-primary">Save Branding</button>
          </form>
        </div>
      </div>
      <div class="card" style="max-width:600px;margin-bottom:24px">
        <div class="card-header"><h2>Logo Upload</h2></div>
        <div class="card-body">
          <div class="form-group">
            <div id="logo-preview" style="margin-bottom:12px">
              <img src="/api/settings/logo" style="max-height:80px;border-radius:8px;border:1px solid var(--border)" onerror="this.style.display='none'" />
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input type="file" class="form-input" id="logo-upload" accept="image/png,image/jpeg,image/gif" style="flex:1;min-width:160px" />
              <button class="btn btn-primary" id="upload-logo-btn"><i class="bi bi-upload"></i> Upload</button>
              <button class="btn btn-danger" id="remove-logo-btn"><i class="bi bi-trash"></i> Remove</button>
            </div>
          </div>
        </div>
      </div>
      <div class="card" style="max-width:600px">
        <div class="card-header"><h2>Favicon Upload</h2></div>
        <div class="card-body">
          <div class="form-group">
            <div id="favicon-preview" style="margin-bottom:12px">
              <img src="/api/settings/favicon" style="max-height:48px;border-radius:4px;border:1px solid var(--border)" onerror="this.style.display='none'" />
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input type="file" class="form-input" id="favicon-upload" accept="image/png,image/x-icon,image/svg+xml,image/gif" style="flex:1;min-width:160px" />
              <button class="btn btn-primary" id="upload-favicon-btn"><i class="bi bi-upload"></i> Upload</button>
              <button class="btn btn-danger" id="remove-favicon-btn"><i class="bi bi-trash"></i> Remove</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('branding-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.updateSettings({
          branding_company_name: document.getElementById('brand-company-name').value,
          branding_tagline: document.getElementById('brand-tagline').value,
          branding_primary_color: document.getElementById('brand-primary-color').value,
          branding_secondary_color: document.getElementById('brand-secondary-color').value,
          branding_footer_text: document.getElementById('brand-footer-text').value,
        });
        await api.updateSettings({
          theme_sidebar_color: document.getElementById('brand-sidebar-color').value,
          theme_accent_color: document.getElementById('brand-accent-color').value,
        });
        document.documentElement.style.setProperty('--primary', document.getElementById('brand-primary-color').value);
        document.documentElement.style.setProperty('--secondary', document.getElementById('brand-secondary-color').value);
        document.documentElement.style.setProperty('--bg-sidebar', document.getElementById('brand-sidebar-color').value);
        document.documentElement.style.setProperty('--purple', document.getElementById('brand-accent-color').value);
        showToast('Branding saved', 'success');
      } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    });

    document.getElementById('upload-logo-btn').addEventListener('click', async () => {
      const file = document.getElementById('logo-upload').files[0];
      if (!file) return showToast('Select a file first', 'warning');
      const fd = new FormData();
      fd.append('logo', file);
      try {
        await api.uploadLogo(fd);
        showToast('Logo uploaded', 'success');
        const img = document.querySelector('#logo-preview img');
        if (img) img.src = '/api/settings/logo?' + Date.now();
      } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    });

    document.getElementById('upload-favicon-btn').addEventListener('click', async () => {
      const file = document.getElementById('favicon-upload').files[0];
      if (!file) return showToast('Select a file first', 'warning');
      const fd = new FormData();
      fd.append('logo', file);
      try {
        await api.uploadFavicon(fd);
        showToast('Favicon uploaded', 'success');
        const img = document.querySelector('#favicon-preview img');
        if (img) img.src = '/api/settings/favicon?' + Date.now();
        const link = document.querySelector('link[rel="icon"]');
        if (link) link.href = '/api/settings/favicon?' + Date.now();
      } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    });

    const removeLogoBtn = document.getElementById('remove-logo-btn');
    if (removeLogoBtn) {
      removeLogoBtn.addEventListener('click', async () => {
        if (!confirm('Remove the current logo?')) return;
        try {
          await api.deleteLogo();
          showToast('Logo removed', 'success');
          const img = document.querySelector('#logo-preview img');
          if (img) img.style.display = 'none';
          document.documentElement.style.setProperty('--logo-display', 'none');
        } catch (err) { showToast('Failed: ' + err.message, 'error'); }
      });
    }

    const removeFaviconBtn = document.getElementById('remove-favicon-btn');
    if (removeFaviconBtn) {
      removeFaviconBtn.addEventListener('click', async () => {
        if (!confirm('Remove the current favicon?')) return;
        try {
          await api.deleteFavicon();
          showToast('Favicon removed', 'success');
          const img = document.querySelector('#favicon-preview img');
          if (img) img.style.display = 'none';
          const link = document.querySelector('link[rel="icon"]');
          if (link) link.href = '/favicon.svg?' + Date.now();
        } catch (err) { showToast('Failed: ' + err.message, 'error'); }
      });
    }
  }

  async renderEmail(container) {
    let cfg = {};
    try { cfg = await api.get('/config'); } catch {}

    container.innerHTML = `
      <div class="card" style="max-width:600px">
        <div class="card-header"><h2><i class="bi bi-envelope" style="color:var(--primary)"></i> Email / SMTP Settings</h2></div>
        <div class="card-body">
          <form id="email-form">
            <div class="form-group">
              <label class="form-label">Enable Email Notifications</label>
              <label class="toggle"><input type="checkbox" id="email-enabled" ${cfg.smtp?.enabled ? 'checked' : ''} /><span class="slider"></span></label>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">SMTP Host</label>
                <input class="form-input" id="email-host" value="${cfg.smtp?.host || ''}" placeholder="smtp.gmail.com" />
              </div>
              <div class="form-group">
                <label class="form-label">SMTP Port</label>
                <input class="form-input" id="email-port" type="number" value="${cfg.smtp?.port || 587}" placeholder="587" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Username</label>
                <input class="form-input" id="email-user" value="${cfg.smtp?.username || ''}" autocomplete="off" />
              </div>
              <div class="form-group">
                <label class="form-label">Password</label>
                <input class="form-input" id="email-pass" type="password" value="${cfg.smtp?.password && cfg.smtp.password !== '••••••' ? cfg.smtp.password : ''}" placeholder="${cfg.smtp?.password === '••••••' ? '(saved)' : 'Enter password'}" autocomplete="new-password" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">From Address</label>
              <input class="form-input" id="email-from" value="${cfg.smtp?.from || ''}" placeholder="noreply@company.com" />
            </div>
            <button type="submit" class="btn btn-primary">Save Email Settings</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('email-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          smtp: {
            enabled: document.getElementById('email-enabled').checked,
            host: document.getElementById('email-host').value,
            port: parseInt(document.getElementById('email-port').value) || 587,
            username: document.getElementById('email-user').value,
            from: document.getElementById('email-from').value
          }
        };
        const passVal = document.getElementById('email-pass').value;
        if (passVal) payload.smtp.password = passVal;
        await api.put('/config', payload);
        showToast('Email settings saved', 'success');
      } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    });
  }

  async renderAD(container) {
    let cfg = {};
    try { cfg = await api.get('/config'); } catch {}

    container.innerHTML = `
      <div class="card" style="max-width:600px">
        <div class="card-header"><h2><i class="bi bi-diagram-3" style="color:var(--purple)"></i> Active Directory / LDAP Settings</h2></div>
        <div class="card-body">
          <form id="ad-form">
            <div class="form-group">
              <label class="form-label">Enable AD/LDAP Sync</label>
              <label class="toggle"><input type="checkbox" id="ad-enabled" ${cfg.ad?.enabled ? 'checked' : ''} /><span class="slider"></span></label>
              <div class="form-hint">Users will be able to login with their AD credentials</div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">LDAP Server URL</label>
                <input class="form-input" id="ad-url" value="${cfg.ad?.url || ''}" placeholder="ldap://domain.local" />
              </div>
              <div class="form-group">
                <label class="form-label">Base DN</label>
                <input class="form-input" id="ad-basedn" value="${cfg.ad?.baseDN || ''}" placeholder="DC=domain,DC=local" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Bind Username</label>
                <input class="form-input" id="ad-user" value="${cfg.ad?.username || ''}" autocomplete="off" />
              </div>
              <div class="form-group">
                <label class="form-label">Bind Password</label>
                <input class="form-input" id="ad-pass" type="password" value="${cfg.ad?.password && cfg.ad.password !== '••••••' ? cfg.ad.password : ''}" placeholder="${cfg.ad?.password === '••••••' ? '(saved)' : 'Enter password'}" autocomplete="new-password" />
              </div>
            </div>
            <button type="submit" class="btn btn-primary">Save AD Settings</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('ad-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          ad: {
            enabled: document.getElementById('ad-enabled').checked,
            url: document.getElementById('ad-url').value,
            baseDN: document.getElementById('ad-basedn').value,
            username: document.getElementById('ad-user').value
          }
        };
        const passVal = document.getElementById('ad-pass').value;
        if (passVal) payload.ad.password = passVal;
        await api.put('/config', payload);
        showToast('AD settings saved', 'success');
      } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    });
  }

  async renderAuditLogs(container) {
    const data = await api.getAuditLogs({ limit: 50 });

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>Audit Logs</h2></div>
        <div class="card-body" style="padding:0">
          <div style="max-height:600px;overflow-y:auto">
            <table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>${(data.logs || []).map(l => `<tr>
              <td style="font-size:12px;white-space:nowrap">${formatDate(l.created_at)}</td>
              <td style="font-size:13px">${escapeHtml(l.user_name || 'System')}</td>
              <td><span class="status-badge badge-progress">${escapeHtml(l.action)}</span></td>
              <td style="font-size:13px">${escapeHtml(l.entity_type)} #${l.entity_id || '-'}</td>
              <td style="font-size:12px;color:var(--text-secondary);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(l.details || '')}</td>
            </tr>`).join('')}</tbody></table>
          </div>
        </div>
      </div>
    `;
  }

  async renderSecurity(container) {
    const security = [
      { key: 'max_login_attempts', label: 'Max Login Attempts', desc: 'Lock account after N failed attempts', type: 'number', default: 5 },
      { key: 'lockout_duration', label: 'Lockout Duration (minutes)', desc: 'How long to lock account after max attempts', type: 'number', default: 30 },
      { key: 'password_min_length', label: 'Minimum Password Length', desc: 'Minimum characters for user passwords', type: 'number', default: 8 },
      { key: 'session_timeout', label: 'Session Timeout (hours)', desc: 'Auto-logout after inactivity', type: 'number', default: 24 },
      { key: 'two_factor_auth', label: 'Require Two-Factor Auth', desc: 'Force all users to enable 2FA', type: 'boolean', default: false },
      { key: 'enforce_https', label: 'Enforce HTTPS', desc: 'Redirect all HTTP traffic to HTTPS', type: 'boolean', default: true },
      { key: 'allowed_domains', label: 'Allowed Email Domains', desc: 'Comma-separated list (leave empty for any)', type: 'text', default: '' },
      { key: 'recaptcha_enabled', label: 'reCAPTCHA on Login', desc: 'Show captcha after failed attempts', type: 'boolean', default: false },
    ];

    const settings = await api.getSettings();
    const current = {};
    (settings.security || []).forEach(s => { current[s.key] = s.value; });

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>Security Settings</h2></div>
        <div class="card-body">
          <form id="security-form">
            ${security.map(s => `
              <div class="form-group">
                <label class="form-label">${escapeHtml(s.label)}</label>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">${escapeHtml(s.desc)}</div>
                ${s.type === 'boolean' ? `
                  <label class="toggle"><input type="checkbox" id="sec-${s.key}" ${current[s.key] === true || current[s.key] === 'true' ? 'checked' : ''} /><span class="slider"></span></label>
                ` : `
                  <input class="form-input" id="sec-${s.key}" type="${s.type === 'number' ? 'number' : 'text'}" value="${escapeHtml(String(current[s.key] != null ? current[s.key] : s.default))}" />
                `}
              </div>
            `).join('')}
            <button type="submit" class="btn btn-primary">Save Security Settings</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('security-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      security.forEach(s => {
        const el = document.getElementById(`sec-${s.key}`);
        data[s.key] = s.type === 'boolean' ? el.checked : (s.type === 'number' ? parseInt(el.value) || el.value : el.value);
      });
      try {
        await api.updateSettings(data);
        showToast('Security settings saved', 'success');
      } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    });
  }

  async renderWorkflows(container) {
    const [rules, typesData, prios, depts, agents] = await Promise.all([
      api.getWorkflowRules(),
      api.getTypes(),
      api.getPriorities(),
      api.getDepartments(),
      api.getUsers({ limit: 100 })
    ]);
    const ticketTypes = typesData.types || [];
    const priorities = prios || [];
    const departments = depts || [];
    const users = agents.users || [];

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2><i class="bi bi-diagram-3"></i> Workflow Routing Rules</h2>
          <button class="btn btn-sm btn-primary" onclick="window._addWorkflowRule()"><i class="bi bi-plus"></i> Add Rule</button>
        </div>
        <div class="card-body" style="padding:0">
          ${rules.length === 0 ? '<div style="padding:30px;text-align:center;color:var(--text-secondary)"><i class="bi bi-diagram-3" style="font-size:40px;display:block;margin-bottom:12px;opacity:0.4"></i><p>No workflow rules defined. Add rules to auto-route tickets.</p></div>' : `
          <table><thead><tr><th>Priority</th><th>Name</th><th>Match Conditions</th><th>Action</th><th>Status</th><th></th></tr></thead>
          <tbody>${rules.map(r => {
            const conditions = [];
            if (r.match_type_name) conditions.push('Type: ' + r.match_type_name);
            if (r.match_category_name) conditions.push('Category: ' + r.match_category_name);
            if (r.match_priority_name) conditions.push('Priority: ' + r.match_priority_name);
            if (r.match_department_name) conditions.push('Dept: ' + r.match_department_name);
            if (r.match_requester_role) conditions.push('Role: ' + r.match_requester_role);
            const action = r.assign_type === 'department' ? 'Route to ' + (r.assign_department_name || 'Dept')
              : r.assign_type === 'agent' ? 'Assign to ' + (r.assign_agent_name || 'Agent')
              : 'Assign to role: ' + r.assign_role;
            return `<tr>
              <td><span class="badge">${r.priority}</span></td>
              <td style="font-weight:500">${escapeHtml(r.name)}</td>
              <td style="font-size:13px">${conditions.length > 0 ? conditions.join(', ') : '<span style="color:var(--text-secondary)">All tickets</span>'}</td>
              <td style="font-size:13px;color:var(--primary)">${escapeHtml(action)}</td>
              <td>${r.is_active ? '<span class="status-badge badge-resolved" style="font-size:11px;padding:2px 10px">Active</span>' : '<span class="status-badge badge-cancelled" style="font-size:11px;padding:2px 10px">Inactive</span>'}</td>
              <td>
                <button class="btn btn-sm btn-ghost" onclick="window._editWorkflowRule(${r.id})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-ghost text-danger" onclick="window._delWorkflowRule(${r.id})"><i class="bi bi-trash"></i></button>
              </td>
            </tr>`;
          }).join('')}</tbody></table>`}
        </div>
      </div>
    `;

    window._addWorkflowRule = () => this.addWorkflowRule(ticketTypes, priorities, departments, users);
    window._editWorkflowRule = (id) => this.editWorkflowRule(id, rules, ticketTypes, priorities, departments, users);
    window._delWorkflowRule = (id) => {
      if (!confirm('Delete this workflow rule?')) return;
      api.deleteWorkflowRule(id).then(() => { showToast('Rule deleted', 'success'); this.loadTab('workflow'); })
        .catch(err => showToast('Failed: ' + err.message, 'error'));
    };
  }

  addWorkflowRule(types, priorities, departments, users) {
    openModal({
      title: 'Add Workflow Rule',
      size: 'lg',
      content: `
        <div class="form-row">
          <div class="form-group"><label class="form-label">Rule Name</label><input class="form-input" id="wf-name" placeholder="e.g. High Priority Incidents" /></div>
          <div class="form-group"><label class="form-label">Priority (lower = checked first)</label><input class="form-input" id="wf-priority" type="number" value="0" /></div>
        </div>
        <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="wf-desc" /></div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:16px">
          <h4 style="font-size:14px;margin-bottom:12px;color:var(--text-secondary)">IF Ticket Matches (leave empty to match all)</h4>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Type</label><select class="form-select" id="wf-match-type"><option value="">Any</option>${types.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="wf-match-priority"><option value="">Any</option>${priorities.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Department</label><select class="form-select" id="wf-match-dept"><option value="">Any</option>${departments.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Requester Role</label><select class="form-select" id="wf-match-role"><option value="">Any</option><option value="user">User</option><option value="agent">Agent</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div>
          </div>
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:16px">
          <h4 style="font-size:14px;margin-bottom:12px;color:var(--text-secondary)">THEN Route Ticket To</h4>
          <div class="form-group"><label class="form-label">Assign Type</label>
            <select class="form-select" id="wf-assign-type">
              <option value="department">Department (auto-assign to first available agent)</option>
              <option value="agent">Specific Agent</option>
              <option value="role">Any agent with role</option>
            </select>
          </div>
          <div class="form-group" id="wf-assign-department-group">
            <label class="form-label">Department</label><select class="form-select" id="wf-assign-dept"><option value="">Select...</option>${departments.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}</select>
          </div>
          <div class="form-group" id="wf-assign-agent-group" style="display:none">
            <label class="form-label">Agent</label><select class="form-select" id="wf-assign-agent"><option value="">Select...</option>${users.filter(u => ['admin','agent','supervisor'].includes(u.role)).map(u => `<option value="${u.id}">${escapeHtml(u.full_name)} (${u.role})</option>`).join('')}</select>
          </div>
          <div class="form-group" id="wf-assign-role-group" style="display:none">
            <label class="form-label">Role</label><select class="form-select" id="wf-assign-role"><option value="agent">Agent</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select>
          </div>
        </div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Create Rule', class: 'btn btn-primary', onclick: async () => {
          try {
            const assignType = document.getElementById('wf-assign-type').value;
            const data = {
              name: document.getElementById('wf-name').value,
              description: document.getElementById('wf-desc').value,
              priority: parseInt(document.getElementById('wf-priority').value) || 0,
              match_type_id: parseInt(document.getElementById('wf-match-type').value) || null,
              match_priority_id: parseInt(document.getElementById('wf-match-priority').value) || null,
              match_department_id: parseInt(document.getElementById('wf-match-dept').value) || null,
              match_requester_role: document.getElementById('wf-match-role').value || '',
              assign_type: assignType,
              assign_department_id: assignType === 'department' ? parseInt(document.getElementById('wf-assign-dept').value) || null : null,
              assign_agent_id: assignType === 'agent' ? parseInt(document.getElementById('wf-assign-agent').value) || null : null,
              assign_role: assignType === 'role' ? document.getElementById('wf-assign-role').value : ''
            };
            await api.createWorkflowRule(data);
            closeModal(); showToast('Workflow rule created', 'success');
            this.loadTab('workflow');
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });

    document.getElementById('wf-assign-type').addEventListener('change', () => {
      const val = document.getElementById('wf-assign-type').value;
      document.getElementById('wf-assign-department-group').style.display = val === 'department' ? '' : 'none';
      document.getElementById('wf-assign-agent-group').style.display = val === 'agent' ? '' : 'none';
      document.getElementById('wf-assign-role-group').style.display = val === 'role' ? '' : 'none';
    });
  }

  editWorkflowRule(id, rules, types, priorities, departments, users) {
    const r = rules.find(x => x.id === id) || {};
    openModal({
      title: 'Edit Workflow Rule',
      size: 'lg',
      content: `
        <div class="form-row">
          <div class="form-group"><label class="form-label">Rule Name</label><input class="form-input" id="wf-name" value="${escapeHtml(r.name || '')}" /></div>
          <div class="form-group"><label class="form-label">Priority</label><input class="form-input" id="wf-priority" type="number" value="${r.priority || 0}" /></div>
        </div>
        <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="wf-desc" value="${escapeHtml(r.description || '')}" /></div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:16px">
          <h4 style="font-size:14px;margin-bottom:12px;color:var(--text-secondary)">IF Ticket Matches</h4>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Type</label><select class="form-select" id="wf-match-type"><option value="">Any</option>${types.map(t => `<option value="${t.id}" ${t.id === r.match_type_id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="wf-match-priority"><option value="">Any</option>${priorities.map(p => `<option value="${p.id}" ${p.id === r.match_priority_id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Department</label><select class="form-select" id="wf-match-dept"><option value="">Any</option>${departments.map(d => `<option value="${d.id}" ${d.id === r.match_department_id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Requester Role</label><select class="form-select" id="wf-match-role"><option value="">Any</option><option value="user" ${r.match_requester_role === 'user' ? 'selected' : ''}>User</option><option value="agent" ${r.match_requester_role === 'agent' ? 'selected' : ''}>Agent</option><option value="supervisor" ${r.match_requester_role === 'supervisor' ? 'selected' : ''}>Supervisor</option><option value="admin" ${r.match_requester_role === 'admin' ? 'selected' : ''}>Admin</option></select></div>
          </div>
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:16px">
          <h4 style="font-size:14px;margin-bottom:12px;color:var(--text-secondary)">THEN Route Ticket To</h4>
          <div class="form-group"><label class="form-label">Assign Type</label>
            <select class="form-select" id="wf-assign-type">
              <option value="department" ${r.assign_type === 'department' ? 'selected' : ''}>Department (auto-assign)</option>
              <option value="agent" ${r.assign_type === 'agent' ? 'selected' : ''}>Specific Agent</option>
              <option value="role" ${r.assign_type === 'role' ? 'selected' : ''}>Any agent with role</option>
            </select>
          </div>
          <div class="form-group" id="wf-assign-department-group" style="${r.assign_type === 'department' ? '' : 'display:none'}">
            <label class="form-label">Department</label><select class="form-select" id="wf-assign-dept"><option value="">Select...</option>${departments.map(d => `<option value="${d.id}" ${d.id === r.assign_department_id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}</select>
          </div>
          <div class="form-group" id="wf-assign-agent-group" style="${r.assign_type === 'agent' ? '' : 'display:none'}">
            <label class="form-label">Agent</label><select class="form-select" id="wf-assign-agent"><option value="">Select...</option>${users.filter(u => ['admin','agent','supervisor'].includes(u.role)).map(u => `<option value="${u.id}" ${u.id === r.assign_agent_id ? 'selected' : ''}>${escapeHtml(u.full_name)} (${u.role})</option>`).join('')}</select>
          </div>
          <div class="form-group" id="wf-assign-role-group" style="${r.assign_type === 'role' ? '' : 'display:none'}">
            <label class="form-label">Role</label><select class="form-select" id="wf-assign-role"><option value="agent" ${r.assign_role === 'agent' ? 'selected' : ''}>Agent</option><option value="supervisor" ${r.assign_role === 'supervisor' ? 'selected' : ''}>Supervisor</option><option value="admin" ${r.assign_role === 'admin' ? 'selected' : ''}>Admin</option></select>
          </div>
        </div>
        <div class="form-group" style="margin-top:12px"><label class="toggle"><input type="checkbox" id="wf-active" ${r.is_active ? 'checked' : ''} /><span class="slider"></span></label><span style="font-size:13px;margin-left:8px">Active</span></div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Save Rule', class: 'btn btn-primary', onclick: async () => {
          try {
            const assignType = document.getElementById('wf-assign-type').value;
            const data = {
              name: document.getElementById('wf-name').value,
              description: document.getElementById('wf-desc').value,
              priority: parseInt(document.getElementById('wf-priority').value) || 0,
              match_type_id: parseInt(document.getElementById('wf-match-type').value) || null,
              match_priority_id: parseInt(document.getElementById('wf-match-priority').value) || null,
              match_department_id: parseInt(document.getElementById('wf-match-dept').value) || null,
              match_requester_role: document.getElementById('wf-match-role').value || '',
              assign_type: assignType,
              assign_department_id: assignType === 'department' ? parseInt(document.getElementById('wf-assign-dept').value) || null : null,
              assign_agent_id: assignType === 'agent' ? parseInt(document.getElementById('wf-assign-agent').value) || null : null,
              assign_role: assignType === 'role' ? document.getElementById('wf-assign-role').value : '',
              is_active: document.getElementById('wf-active').checked
            };
            await api.updateWorkflowRule(id, data);
            closeModal(); showToast('Workflow rule updated', 'success');
            this.loadTab('workflow');
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });

    document.getElementById('wf-assign-type').addEventListener('change', () => {
      const val = document.getElementById('wf-assign-type').value;
      document.getElementById('wf-assign-department-group').style.display = val === 'department' ? '' : 'none';
      document.getElementById('wf-assign-agent-group').style.display = val === 'agent' ? '' : 'none';
      document.getElementById('wf-assign-role-group').style.display = val === 'role' ? '' : 'none';
    });
  }

  addPriority() {
    openModal({
      title: 'Add Priority',
      content: `
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="prio-name" /></div>
        <div class="form-group"><label class="form-label">Level (1=lowest)</label><input class="form-input" id="prio-level" type="number" value="1" /></div>
        <div class="form-group"><label class="form-label">Color</label><input class="form-input" id="prio-color" type="color" value="#6c757d" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Response (minutes)</label><input class="form-input" id="prio-response" type="number" value="60" /></div>
          <div class="form-group"><label class="form-label">Resolution (minutes)</label><input class="form-input" id="prio-resolution" type="number" value="480" /></div>
        </div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Create', class: 'btn btn-primary', onclick: async () => {
          try {
            await api.createPriority({
              name: document.getElementById('prio-name').value, level: parseInt(document.getElementById('prio-level').value),
              color: document.getElementById('prio-color').value, sla_response_minutes: parseInt(document.getElementById('prio-response').value),
              sla_resolution_minutes: parseInt(document.getElementById('prio-resolution').value)
            });
            closeModal(); showToast('Priority created', 'success');
            this.loadTab('sla');
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });
  }

  editPriority(id, priorities) {
    const p = priorities.find(x => x.id === id) || {};
    openModal({
      title: 'Edit Priority',
      content: `
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="prio-name" value="${escapeHtml(p.name || '')}" /></div>
        <div class="form-group"><label class="form-label">Level</label><input class="form-input" id="prio-level" type="number" value="${p.level || 1}" /></div>
        <div class="form-group"><label class="form-label">Color</label><input class="form-input" id="prio-color" type="color" value="${p.color || '#6c757d'}" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Response (minutes)</label><input class="form-input" id="prio-response" type="number" value="${p.sla_response_minutes || 60}" /></div>
          <div class="form-group"><label class="form-label">Resolution (minutes)</label><input class="form-input" id="prio-resolution" type="number" value="${p.sla_resolution_minutes || 480}" /></div>
        </div>
        <div class="form-group"><label class="toggle"><input type="checkbox" id="prio-active" ${p.is_active ? 'checked' : ''} /><span class="slider"></span></label><span style="font-size:13px;margin-left:8px">Active</span></div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Save', class: 'btn btn-primary', onclick: async () => {
          try {
            await api.updatePriority(id, {
              name: document.getElementById('prio-name').value, level: parseInt(document.getElementById('prio-level').value),
              color: document.getElementById('prio-color').value, sla_response_minutes: parseInt(document.getElementById('prio-response').value),
              sla_resolution_minutes: parseInt(document.getElementById('prio-resolution').value), is_active: document.getElementById('prio-active').checked
            });
            closeModal(); showToast('Priority updated', 'success');
            this.loadTab('sla');
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });
  }

  addSLAPolicy(priorities) {
    const types = this._ticketTypes || [];
    openModal({
      title: 'Add SLA Policy',
      size: 'lg',
      content: `
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="sla-name" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="sla-priority">${priorities.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Requester Role</label><select class="form-select" id="sla-role"><option value="">Any Role</option><option value="user">User</option><option value="agent">Agent</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Ticket Type <span style="font-size:12px;color:var(--text-secondary)">(leave empty for all types)</span></label><select class="form-select" id="sla-type"><option value="">Any Type</option>${types.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Response Time (min)</label><input class="form-input" id="sla-response" type="number" value="60" /></div>
          <div class="form-group"><label class="form-label">Resolution Time (min)</label><input class="form-input" id="sla-resolution" type="number" value="480" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Escalation Time (min, 0=off)</label><input class="form-input" id="sla-escalation" type="number" value="0" /></div>
          <div class="form-group"><label class="toggle"><input type="checkbox" id="sla-bizhours" checked /><span class="slider"></span></label><span style="font-size:13px;margin-left:8px">Business hours only</span></div>
        </div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Create', class: 'btn btn-primary', onclick: async () => {
          try {
            await api.createSLAPolicy({
              name: document.getElementById('sla-name').value,
              priority_id: parseInt(document.getElementById('sla-priority').value),
              requester_role: document.getElementById('sla-role').value || '',
              ticket_type_id: parseInt(document.getElementById('sla-type').value) || null,
              response_time_minutes: parseInt(document.getElementById('sla-response').value),
              resolution_time_minutes: parseInt(document.getElementById('sla-resolution').value),
              escalation_time_minutes: parseInt(document.getElementById('sla-escalation').value),
              business_hours_only: document.getElementById('sla-bizhours').checked
            });
            closeModal(); showToast('SLA policy created', 'success');
            this.loadTab('sla');
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });
  }

  editSLAPolicy(id, policies, priorities) {
    const p = policies.find(x => x.id === id) || {};
    const types = this._ticketTypes || [];
    openModal({
      title: 'Edit SLA Policy',
      size: 'lg',
      content: `
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="sla-name" value="${escapeHtml(p.name || '')}" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="sla-priority">${priorities.map(pr => `<option value="${pr.id}" ${pr.id === p.priority_id ? 'selected' : ''}>${escapeHtml(pr.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Requester Role</label><select class="form-select" id="sla-role"><option value="">Any Role</option><option value="user" ${p.requester_role === 'user' ? 'selected' : ''}>User</option><option value="agent" ${p.requester_role === 'agent' ? 'selected' : ''}>Agent</option><option value="supervisor" ${p.requester_role === 'supervisor' ? 'selected' : ''}>Supervisor</option><option value="admin" ${p.requester_role === 'admin' ? 'selected' : ''}>Admin</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Ticket Type</label><select class="form-select" id="sla-type"><option value="">Any Type</option>${types.map(t => `<option value="${t.id}" ${t.id === p.ticket_type_id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}</select></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Response Time (min)</label><input class="form-input" id="sla-response" type="number" value="${p.response_time_minutes || 60}" /></div>
          <div class="form-group"><label class="form-label">Resolution Time (min)</label><input class="form-input" id="sla-resolution" type="number" value="${p.resolution_time_minutes || 480}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Escalation Time (min)</label><input class="form-input" id="sla-escalation" type="number" value="${p.escalation_time_minutes || 0}" /></div>
          <div class="form-group"><label class="toggle"><input type="checkbox" id="sla-bizhours" ${p.business_hours_only ? 'checked' : ''} /><span class="slider"></span></label><span style="font-size:13px;margin-left:8px">Business hours only</span></div>
        </div>
        <div class="form-group"><label class="toggle"><input type="checkbox" id="sla-active" ${p.is_active ? 'checked' : ''} /><span class="slider"></span></label><span style="font-size:13px;margin-left:8px">Active</span></div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Save', class: 'btn btn-primary', onclick: async () => {
          try {
            await api.updateSLAPolicy(id, {
              name: document.getElementById('sla-name').value,
              priority_id: parseInt(document.getElementById('sla-priority').value),
              requester_role: document.getElementById('sla-role').value || '',
              ticket_type_id: parseInt(document.getElementById('sla-type').value) || null,
              response_time_minutes: parseInt(document.getElementById('sla-response').value),
              resolution_time_minutes: parseInt(document.getElementById('sla-resolution').value),
              escalation_time_minutes: parseInt(document.getElementById('sla-escalation').value),
              business_hours_only: document.getElementById('sla-bizhours').checked,
              is_active: document.getElementById('sla-active').checked
            });
            closeModal(); showToast('SLA policy updated', 'success');
            this.loadTab('sla');
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });
  }

  addType() {
    const colors = ['#dc3545','#fd7e14','#ffc107','#28a745','#0d6efd','#6f42c1','#20c997','#e83e8c'];
    openModal({
      title: 'Add Ticket Type',
      content: `
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="type-name" /></div>
        <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="type-desc" /></div>
        <div class="form-group"><label class="form-label">Icon (Bootstrap icon name, e.g. 'bug', 'gear')</label><input class="form-input" id="type-icon" value="ticket" /></div>
        <div class="form-group"><label class="form-label">Color</label>
          <div class="color-picker">${colors.map(c => `<div class="color-opt" style="background:${c}" data-color="${c}"></div>`).join('')}</div>
          <input type="hidden" id="type-color" value="#6c757d" />
        </div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Create', class: 'btn btn-primary', onclick: async () => {
          try {
            await api.createType({
              name: document.getElementById('type-name').value, description: document.getElementById('type-desc').value,
              icon: document.getElementById('type-icon').value, color: document.getElementById('type-color').value
            });
            closeModal(); showToast('Type created', 'success');
            this.loadTab('types');
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });
    document.querySelectorAll('.color-opt').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.color-opt').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        document.getElementById('type-color').value = el.dataset.color;
      });
    });
  }

  editType(id, types) {
    const t = types.find(x => x.id === id) || {};
    openModal({
      title: 'Edit Ticket Type',
      content: `
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="type-name" value="${escapeHtml(t.name || '')}" /></div>
        <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="type-desc" value="${escapeHtml(t.description || '')}" /></div>
        <div class="form-group"><label class="form-label">Icon</label><input class="form-input" id="type-icon" value="${escapeHtml(t.icon || 'ticket')}" /></div>
        <div class="form-group"><label class="form-label">Color</label><input class="form-input" id="type-color" type="color" value="${t.color || '#6c757d'}" /></div>
        <div class="form-group"><label class="toggle"><input type="checkbox" id="type-active" ${t.is_active ? 'checked' : ''} /><span class="slider"></span></label><span style="font-size:13px;margin-left:8px">Active</span></div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Save', class: 'btn btn-primary', onclick: async () => {
          try {
            await api.updateType(id, {
              name: document.getElementById('type-name').value, description: document.getElementById('type-desc').value,
              icon: document.getElementById('type-icon').value, color: document.getElementById('type-color').value,
              is_active: document.getElementById('type-active').checked
            });
            closeModal(); showToast('Type updated', 'success');
            this.loadTab('types');
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });
  }

  addCategory(data) {
    openModal({
      title: 'Add Category',
      content: `
        <div class="form-group"><label class="form-label">Type</label><select class="form-select" id="cat-type">${(data.types || []).map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="cat-name" /></div>
        <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="cat-desc" /></div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Create', class: 'btn btn-primary', onclick: async () => {
          try {
            await api.createCategory({
              type_id: parseInt(document.getElementById('cat-type').value),
              name: document.getElementById('cat-name').value,
              description: document.getElementById('cat-desc').value
            });
            closeModal(); showToast('Category created', 'success');
            this.loadTab('types');
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });
  }

  editCategory(id, data) {
    const c = (data.categories || []).find(x => x.id === id) || {};
    openModal({
      title: 'Edit Category',
      content: `
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="cat-name" value="${escapeHtml(c.name || '')}" /></div>
        <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="cat-desc" value="${escapeHtml(c.description || '')}" /></div>
        <div class="form-group"><label class="toggle"><input type="checkbox" id="cat-active" ${c.is_active ? 'checked' : ''} /><span class="slider"></span></label><span style="font-size:13px;margin-left:8px">Active</span></div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Save', class: 'btn btn-primary', onclick: async () => {
          try {
            await api.updateCategory(id, {
              name: document.getElementById('cat-name').value, description: document.getElementById('cat-desc').value,
              is_active: document.getElementById('cat-active').checked
            });
            closeModal(); showToast('Category updated', 'success');
            this.loadTab('types');
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });
  }
}
