import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { showToast } from '../components/Toast.js';
import { getUserRoleBadge, escapeHtml } from '../utils.js';

export default class ProfilePage {
  cleanup() {
    if (this._cleanups) this._cleanups.forEach(fn => fn());
  }

  render() {
    return `
      <div class="app-layout">
        ${Sidebar.render('profile')}
        <div class="main-content">
          ${Header.render()}
          <div class="page-content">
            <h2 style="font-size:22px;font-weight:600;margin-bottom:20px">My Profile</h2>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
              <div class="card">
                <div class="card-header"><h2>Profile Information</h2></div>
                <div class="card-body">
                  <form id="profile-form">
                    <div class="form-group">
                      <label class="form-label">Full Name</label>
                      <input class="form-input" id="profile-name" />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Email</label>
                      <input class="form-input" id="profile-email" type="email" />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Phone</label>
                      <input class="form-input" id="profile-phone" />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Job Title</label>
                      <input class="form-input" id="profile-job-title" />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Signature (appears on responses)</label>
                      <textarea class="form-textarea" id="profile-signature" style="min-height:60px"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Update Profile</button>
                  </form>
                </div>
              </div>
              <div>
                <div class="card" style="margin-bottom:24px">
                  <div class="card-body" style="text-align:center;padding:30px" id="profile-info">
                    <div style="position:relative;display:inline-block;margin:0 auto 12px">
                      <div class="user-avatar" id="profile-avatar-display" style="width:72px;height:72px;font-size:28px;cursor:pointer"></div>
                      <div id="avatar-upload-overlay" style="position:absolute;bottom:0;right:0;background:var(--primary);color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;border:2px solid var(--bg-card);box-shadow:var(--shadow)">
                        <i class="bi bi-camera"></i>
                      </div>
                      <input type="file" id="avatar-input" accept="image/png,image/jpeg,image/gif" style="display:none" />
                    </div>
                    <h3 style="font-size:18px" id="profile-display-name"></h3>
                    <p style="color:var(--text-secondary);margin:4px 0" id="profile-display-email"></p>
                    <p style="font-size:13px;color:var(--text-secondary);margin:2px 0" id="profile-display-dept"></p>
                    <div style="margin-top:8px" id="profile-display-role"></div>
                    <div style="margin-top:8px;display:flex;gap:8px;justify-content:center">
                      <button class="btn btn-sm btn-ghost" id="remove-avatar-btn" style="display:none;font-size:12px"><i class="bi bi-trash"></i> Remove Photo</button>
                    </div>
                  </div>
                </div>
                <div class="card">
                  <div class="card-header"><h2>Change Password</h2></div>
                  <div class="card-body">
                    <form id="password-form">
                      <div class="form-group">
                        <label class="form-label">Current Password</label>
                        <input class="form-input" type="password" id="pw-current" required />
                      </div>
                      <div class="form-group">
                        <label class="form-label">New Password</label>
                        <input class="form-input" type="password" id="pw-new" required minlength="6" />
                      </div>
                      <button type="submit" class="btn btn-primary">Change Password</button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  afterRender(user) {
    Sidebar.afterRender(user);
    Header.afterRender(user, 'Profile');

    document.getElementById('profile-name').value = user.full_name || '';
    document.getElementById('profile-email').value = user.email || '';
    document.getElementById('profile-phone').value = user.phone || '';
    document.getElementById('profile-job-title').value = user.job_title || '';
    document.getElementById('profile-signature').value = user.signature || '';

    this.updateProfileDisplay(user);

    const avatarInput = document.getElementById('avatar-input');
    document.getElementById('avatar-upload-overlay').addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('avatar', file);
      try {
        const data = await api.uploadAvatar(fd);
        showToast('Profile picture updated', 'success');
        user.avatar = data.avatar;
        this.updateProfileDisplay(user);
      } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
      }
    });

    const removeBtn = document.getElementById('remove-avatar-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        try {
          await api.deleteAvatar();
          user.avatar = null;
          this.updateProfileDisplay(user);
          showToast('Profile picture removed', 'info');
        } catch (err) {
          showToast('Failed: ' + err.message, 'error');
        }
      });
    }

    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const updated = await api.updateProfile({
          full_name: document.getElementById('profile-name').value,
          email: document.getElementById('profile-email').value,
          phone: document.getElementById('profile-phone').value,
          job_title: document.getElementById('profile-job-title').value,
          signature: document.getElementById('profile-signature').value
        });
        Object.assign(user, updated);
        this.updateProfileDisplay(user);
        showToast('Profile updated', 'success');
      } catch (err) {
        showToast('Update failed: ' + err.message, 'error');
      }
    });

    const pwForm = document.getElementById('password-form');
    pwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.changePassword(
          document.getElementById('pw-current').value,
          document.getElementById('pw-new').value
        );
        showToast('Password changed', 'success');
        pwForm.reset();
      } catch (err) {
        showToast('Failed: ' + err.message, 'error');
      }
    });
  }

  updateProfileDisplay(user) {
    const avatarEl = document.getElementById('profile-avatar-display');
    const removeBtn = document.getElementById('remove-avatar-btn');
    if (user.avatar) {
      avatarEl.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
      if (removeBtn) removeBtn.style.display = '';
    } else {
      avatarEl.textContent = (user.full_name || 'U')[0];
      if (removeBtn) removeBtn.style.display = 'none';
    }
    document.getElementById('profile-display-name').textContent = user.full_name || '';
    document.getElementById('profile-display-email').textContent = user.email || '';
    const deptEl = document.getElementById('profile-display-dept');
    if (user.department_name) {
      deptEl.textContent = user.department_name + (user.job_title ? ` - ${user.job_title}` : '');
    } else if (user.job_title) {
      deptEl.textContent = user.job_title;
    } else {
      deptEl.textContent = '';
    }
    document.getElementById('profile-display-role').innerHTML = getUserRoleBadge(user.role);
  }
}
