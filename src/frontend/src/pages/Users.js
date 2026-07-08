import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { showToast } from '../components/Toast.js';
import { escapeHtml, formatDate } from '../utils.js';
import { openModal, closeModal } from '../components/Modal.js';

export default class UsersPage {
  cleanup() {
    if (this._cleanups) this._cleanups.forEach(fn => fn());
  }

  render() {
    return `
      <div class="app-layout">
        ${Sidebar.render('users')}
        <div class="main-content">
          ${Header.render()}
          <div class="page-content">
            <div class="page-title">
              <span>User Management</span>
              <div class="page-title-actions" id="user-actions">
              </div>
            </div>

            <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px" id="user-stats"></div>

            <div class="filters-bar" id="filters-bar">
              <div class="form-input-group" style="min-width:200px;flex:1">
                <span class="input-addon"><i class="bi bi-search"></i></span>
                <input class="form-input" id="filter-search" placeholder="Search users..." style="border:none" />
              </div>
              <select class="form-select" id="filter-role" style="min-width:130px">
                <option value="">All Roles</option>
                <option value="admin">Admin</option><option value="supervisor">Supervisor</option>
                <option value="agent">Agent</option><option value="user">User</option>
              </select>
              <select class="form-select" id="filter-status" style="min-width:130px">
                <option value="">All Status</option><option value="1">Active</option><option value="0">Inactive</option>
              </select>
              <button class="btn btn-ghost btn-sm" id="filter-clear"><i class="bi bi-x-circle"></i></button>
            </div>

            <div class="card">
              <div class="card-body" style="padding:0" id="users-table-container">
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
    Sidebar.afterRender(user);
    Header.afterRender(user, 'Users');

    this.filters = { page: 1, limit: 25 };
    this.totalPages = 1;

    await this.loadStats();

    const search = document.getElementById('filter-search');
    const role = document.getElementById('filter-role');
    const status = document.getElementById('filter-status');

    const applyFilter = () => {
      this.filters.search = search.value;
      this.filters.role = role.value;
      this.filters.is_active = status.value;
      this.filters.page = 1;
      this.loadUsers();
    };

    search.addEventListener('input', debounce(applyFilter, 400));
    role.addEventListener('change', applyFilter);
    status.addEventListener('change', applyFilter);
    document.getElementById('filter-clear').addEventListener('click', () => { search.value = ''; role.value = ''; status.value = ''; applyFilter(); });

    const actions = document.getElementById('user-actions');
    if (['admin', 'supervisor'].includes(user.role)) {
      let html = '';
      if (user.role === 'admin') {
        html += `<button class="btn btn-sm" onclick="window._showBulkImport()"><i class="bi bi-upload"></i> Bulk Import</button>`;
        html += `<button class="btn btn-sm" onclick="window._syncAD()"><i class="bi bi-arrow-repeat"></i> Sync AD</button>`;
      }
      html += `<button class="btn btn-primary btn-sm" onclick="window._addUser()"><i class="bi bi-plus-lg"></i> Add User</button>`;
      actions.innerHTML = html;
    }

    window._addUser = () => this.showAddUserModal(user);
    window._showBulkImport = () => this.showBulkImportModal();
    window._syncAD = () => this.syncAD();
    window._editUser = (id) => this.showEditUserModal(id);
    window._resetPassword = (id, name) => this.resetPassword(id, name);
    window._toggleUser = (id, active) => this.toggleUserStatus(id, active);

    this.loadUsers();
  }

  async loadStats() {
    try {
      const stats = await api.getUserStats();
      document.getElementById('user-stats').innerHTML = `
        <div class="stat-card"><div class="stat-icon blue"><i class="bi bi-people"></i></div><div class="stat-info"><div class="value">${stats.total}</div><div class="label">Total Users</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="bi bi-person-check"></i></div><div class="stat-info"><div class="value">${stats.active}</div><div class="label">Active</div></div></div>
        <div class="stat-card"><div class="stat-icon purple"><i class="bi bi-headset"></i></div><div class="stat-info"><div class="value">${stats.agents}</div><div class="label">Agents</div></div></div>
        <div class="stat-card"><div class="stat-icon yellow"><i class="bi bi-shield-lock"></i></div><div class="stat-info"><div class="value">${stats.admins}</div><div class="label">Admins</div></div></div>
      `;
    } catch {}
  }

  async loadUsers() {
    try {
      const container = document.getElementById('users-table-container');
      container.innerHTML = '<div class="skeleton" style="height:400px;margin:20px"></div>';
      document.getElementById('pagination').innerHTML = '';

      const params = {};
      Object.entries(this.filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const data = await api.getUsers(params);

      this.totalPages = data.totalPages;

      if (data.users.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="bi bi-people"></i><h3>No users found</h3></div>';
        return;
      }

      const roleColors = { admin: 'role-admin', agent: 'role-agent', supervisor: 'role-supervisor', user: 'role-user' };
      container.innerHTML = `
        <div class="table-container">
          <table><thead><tr><th>User</th><th>Username</th><th>Role</th><th>Department</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>${data.users.map(u => `<tr>
            <td><div style="display:flex;align-items:center;gap:10px"><div class="user-avatar" style="width:32px;height:32px;font-size:12px;flex-shrink:0">${(u.full_name || '?')[0]}</div><div><div style="font-weight:600;font-size:14px">${escapeHtml(u.full_name)}</div><div style="font-size:12px;color:var(--text-secondary)">${escapeHtml(u.email)}</div></div></div></td>
            <td style="font-size:13px">${escapeHtml(u.username)}</td>
            <td><span class="role-badge ${roleColors[u.role] || ''}">${u.role}</span></td>
            <td style="font-size:13px">${escapeHtml(u.department_name || '-')}</td>
            <td>${u.is_active ? '<span style="color:var(--success)"><i class="bi bi-check-circle-fill"></i> Active</span>' : '<span style="color:var(--danger)"><i class="bi bi-x-circle-fill"></i> Inactive</span>'}</td>
            <td style="font-size:12px;color:var(--text-secondary)">${u.last_login ? formatDate(u.last_login) : 'Never'}</td>
            <td><button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();window._editUser(${u.id})"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-ghost text-warning" onclick="event.stopPropagation();window._resetPassword(${u.id}, '${escapeHtml(u.full_name)}')" title="Reset Password"><i class="bi bi-key"></i></button>
            <button class="btn btn-sm btn-ghost ${u.is_active ? 'text-danger' : 'text-success'}" onclick="event.stopPropagation();window._toggleUser(${u.id}, ${!u.is_active})"><i class="bi ${u.is_active ? 'bi-pause-circle' : 'bi-play-circle'}"></i></button></td>
          </tr>`).join('')}</tbody></table>
        </div>`;

      this.renderPagination();
    } catch (err) {
      showToast('Failed to load users: ' + err.message, 'error');
    }
  }

  renderPagination() {
    const el = document.getElementById('pagination');
    if (!el || this.totalPages <= 1) { if (el) el.innerHTML = ''; return; }
    const page = this.filters.page;
    let html = `<button ${page <= 1 ? 'disabled' : ''} onclick="window._userPage(${page - 1})">Prev</button>`;
    for (let i = Math.max(1, page - 2); i <= Math.min(this.totalPages, page + 2); i++)
      html += `<button class="${i === page ? 'active' : ''}" onclick="window._userPage(${i})">${i}</button>`;
    html += `<button ${page >= this.totalPages ? 'disabled' : ''} onclick="window._userPage(${page + 1})">Next</button>`;
    html += `<span class="info">${page} of ${this.totalPages}</span>`;
    el.innerHTML = html;
    window._userPage = (p) => { this.filters.page = p; this.loadUsers(); };
  }

  showAddUserModal(currentUser) {
    openModal({
      title: 'Add User',
      size: 'lg',
      content: `
        <div class="form-row">
          <div class="form-group"><label class="form-label">Username <span class="required">*</span></label><input class="form-input" id="user-username" required /></div>
          <div class="form-group"><label class="form-label">Password <span class="required">*</span></label><input class="form-input" id="user-password" type="password" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Full Name <span class="required">*</span></label><input class="form-input" id="user-fullname" required /></div>
          <div class="form-group"><label class="form-label">Email <span class="required">*</span></label><input class="form-input" id="user-email" type="email" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Role</label><select class="form-select" id="user-role"><option value="user">User</option><option value="agent">Agent</option><option value="supervisor">Supervisor</option>${currentUser?.role === 'admin' ? '<option value="admin">Admin</option>' : ''}</select></div>
          <div class="form-group"><label class="form-label">Department</label><select class="form-select" id="user-dept"><option value="">None</option></select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="user-phone" /></div>
          <div class="form-group"><label class="form-label">Job Title</label><input class="form-input" id="user-jobtitle" /></div>
        </div>
        <div id="user-dept-loading" style="display:none;color:var(--text-secondary);font-size:13px;text-align:center">Loading departments...</div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Create User', class: 'btn btn-primary', onclick: async () => {
          try {
            await api.createUser({
              username: document.getElementById('user-username').value,
              password: document.getElementById('user-password').value,
              full_name: document.getElementById('user-fullname').value,
              email: document.getElementById('user-email').value,
              role: document.getElementById('user-role').value,
              department_id: parseInt(document.getElementById('user-dept').value) || null,
              phone: document.getElementById('user-phone').value,
              job_title: document.getElementById('user-jobtitle').value
            });
            closeModal(); showToast('User created', 'success');
            this.loadUsers(); this.loadStats();
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });
    api.getDepartments().then(d => {
      const el = document.getElementById('user-dept');
      if (el) {
        d.forEach(dept => { const o = document.createElement('option'); o.value = dept.id; o.textContent = dept.name; el.appendChild(o); });
      }
    }).catch(() => {});
  }

  showEditUserModal(id) {
    api.getUser(id).then(u => {
      openModal({
        title: 'Edit User',
        size: 'lg',
        content: `
          <div class="form-row">
            <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="edit-fullname" value="${escapeHtml(u.full_name)}" /></div>
            <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="edit-email" value="${escapeHtml(u.email)}" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Role</label><select class="form-select" id="edit-role"><option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option><option value="agent" ${u.role === 'agent' ? 'selected' : ''}>Agent</option><option value="supervisor" ${u.role === 'supervisor' ? 'selected' : ''}>Supervisor</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select></div>
            <div class="form-group"><label class="form-label">Department</label><select class="form-select" id="edit-dept"><option value="">None</option></select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="edit-phone" value="${escapeHtml(u.phone || '')}" /></div>
            <div class="form-group"><label class="form-label">Job Title</label><input class="form-input" id="edit-jobtitle" value="${escapeHtml(u.job_title || '')}" /></div>
          </div>
          <div class="form-group"><label class="form-label">New Password (leave empty to keep current)</label><input class="form-input" id="edit-password" type="password" /></div>`,
        buttons: [
          { text: 'Cancel', class: 'btn', onclick: closeModal },
          { text: 'Save Changes', class: 'btn btn-primary', onclick: async () => {
            try {
              const data = {
                full_name: document.getElementById('edit-fullname').value,
                email: document.getElementById('edit-email').value,
                role: document.getElementById('edit-role').value,
                department_id: parseInt(document.getElementById('edit-dept').value) || null,
                phone: document.getElementById('edit-phone').value,
                job_title: document.getElementById('edit-jobtitle').value
              };
              const pw = document.getElementById('edit-password').value;
              if (pw) data.password = pw;
              await api.updateUser(id, data);
              closeModal(); showToast('User updated', 'success');
              this.loadUsers();
            } catch (err) { showToast('Failed: ' + err.message, 'error'); }
          }}
        ]
      });
      api.getDepartments().then(d => {
        const el = document.getElementById('edit-dept');
        d.forEach(dept => { const o = document.createElement('option'); o.value = dept.id; o.textContent = dept.name; if (dept.id === u.department_id) o.selected = true; el.appendChild(o); });
      }).catch(() => {});
    }).catch(err => showToast('Failed: ' + err.message, 'error'));
  }

  toggleUserStatus(id, active) {
    api.updateUser(id, { is_active: active }).then(() => {
      showToast(`User ${active ? 'activated' : 'deactivated'}`, 'success');
      this.loadUsers(); this.loadStats();
    }).catch(err => showToast('Failed: ' + err.message, 'error'));
  }

  showBulkImportModal() {
    openModal({
      title: 'Bulk Import Users',
      size: 'lg',
      content: `
        <p style="margin-bottom:16px;color:var(--text-secondary)">Upload a CSV file with columns: <code>username, full_name, email, role, password</code></p>
        <div class="file-drop-zone" style="padding:30px;text-align:center;border:2px dashed var(--border);border-radius:12px;margin-bottom:16px;cursor:pointer" id="bulk-drop-zone">
          <i class="bi bi-file-earmark-spreadsheet" style="font-size:40px;color:var(--primary);display:block;margin-bottom:10px"></i>
          <p style="font-weight:600">Click to select CSV file</p>
          <p style="font-size:12px;color:var(--text-secondary)">or drag and drop here</p>
          <input type="file" id="bulk-csv-input" accept=".csv" style="display:none" />
        </div>
        <div id="bulk-preview" style="max-height:300px;overflow-y:auto"></div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Import Users', class: 'btn btn-primary', onclick: async () => {
          const preview = document.getElementById('bulk-preview');
          const rows = JSON.parse(preview.dataset.rows || '[]');
          if (rows.length === 0) return showToast('No data to import', 'warning');
          let success = 0, failed = 0;
          for (const row of rows) {
            try {
              await api.createUser(row);
              success++;
            } catch { failed++; }
          }
          closeModal();
          showToast(`Imported ${success} users${failed ? `, ${failed} failed` : ''}`, failed ? 'warning' : 'success');
          this.loadUsers(); this.loadStats();
        }}
      ]
    });

    const dropZone = document.getElementById('bulk-drop-zone');
    const fileInput = document.getElementById('bulk-csv-input');
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => this.parseCSV(fileInput));
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--border)'; fileInput.files = e.dataTransfer.files; this.parseCSV(fileInput); });
  }

  parseCSV(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n').filter(l => l.trim());
      if (lines.length < 2) return showToast('CSV must have header + data rows', 'warning');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => { if (h === 'password') obj[h] = vals[i] || 'Welcome123'; else obj[h] = vals[i] || ''; });
        return obj;
      });
      const preview = document.getElementById('bulk-preview');
      preview.dataset.rows = JSON.stringify(rows);
      preview.innerHTML = `
        <p style="font-weight:600;margin-bottom:8px">Preview: ${rows.length} users</p>
        <table><thead><tr><th>Username</th><th>Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>${rows.slice(0, 10).map(r => `<tr><td>${escapeHtml(r.username)}</td><td>${escapeHtml(r.full_name)}</td><td>${escapeHtml(r.email)}</td><td>${escapeHtml(r.role || 'user')}</td></tr>`).join('')}
        ${rows.length > 10 ? `<tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">...and ${rows.length - 10} more</td></tr>` : ''}
        </tbody></table>`;
    };
    reader.readAsText(file);
  }

  resetPassword(id, fullName) {
    openModal({
      title: 'Reset Password',
      content: `
        <div style="text-align:center;padding:10px 0 20px">
          <i class="bi bi-key" style="font-size:48px;color:var(--warning);display:block;margin-bottom:12px"></i>
          <p style="margin-bottom:16px">Reset password for <strong>${escapeHtml(fullName)}</strong></p>
          <div class="form-group" style="text-align:left">
            <label class="form-label">New Password</label>
            <input class="form-input" id="reset-pw" type="password" placeholder="Enter new password" />
          </div>
          <div class="form-group" style="text-align:left">
            <label class="form-label">Confirm Password</label>
            <input class="form-input" id="reset-pw-confirm" type="password" placeholder="Confirm new password" />
          </div>
        </div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Reset Password', class: 'btn btn-warning', onclick: async () => {
          const pw = document.getElementById('reset-pw').value;
          const confirm = document.getElementById('reset-pw-confirm').value;
          if (!pw || pw.length < 4) return showToast('Password must be at least 4 characters', 'warning');
          if (pw !== confirm) return showToast('Passwords do not match', 'warning');
          try {
            await api.updateUser(id, { password: pw });
            closeModal();
            showToast('Password reset successfully', 'success');
          } catch (err) { showToast('Failed: ' + err.message, 'error'); }
        }}
      ]
    });
  }

  syncAD() {
    openModal({
      title: 'Active Directory Sync',
      content: `
        <div style="text-align:center;padding:20px">
          <i class="bi bi-arrow-repeat" style="font-size:48px;color:var(--primary);display:block;margin-bottom:12px"></i>
          <p style="margin-bottom:16px">Sync users from Active Directory? This will import/update users from your configured AD server.</p>
          <div class="form-group" style="text-align:left">
            <label class="form-label">Default role for new AD users</label>
            <select class="form-select" id="ad-default-role"><option value="user">User</option><option value="agent">Agent</option></select>
          </div>
        </div>`,
      buttons: [
        { text: 'Cancel', class: 'btn', onclick: closeModal },
        { text: 'Start Sync', class: 'btn btn-primary', onclick: async () => {
          try {
            const role = document.getElementById('ad-default-role')?.value || 'user';
            await api.post('/users/ad-sync', { default_role: role });
            closeModal();
            showToast('AD Sync completed', 'success');
            this.loadUsers(); this.loadStats();
          } catch (err) { showToast('AD Sync failed: ' + err.message, 'error'); }
        }}
      ]
    });
  }
}

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}
