import api from '../api.js';
import Sidebar from '../components/Sidebar.js';
import Header from '../components/Header.js';
import { showToast } from '../components/Toast.js';
import { openModal, closeModal } from '../components/Modal.js';
import { syncAvatar } from '../components/Header.js';
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
            <div class="page-header">
              <h2 class="page-title">My Profile</h2>
              <p class="page-desc">Manage your account settings and profile information.</p>
            </div>
            <div class="profile-layout">
              <div class="profile-sidebar">
                <div class="card">
                  <div class="card-body" style="text-align:center;padding:32px 24px" id="profile-info">
                    <div class="profile-avatar-wrapper">
                      <div class="user-avatar" id="profile-avatar-display"></div>
                      <div class="profile-avatar-overlay" id="avatar-upload-overlay" title="Change photo">
                        <i class="bi bi-camera"></i>
                      </div>
                      <input type="file" id="avatar-input" accept="image/png,image/jpeg,image/gif" style="display:none" />
                    </div>
                    <h3 id="profile-display-name" class="profile-name"></h3>
                    <p id="profile-display-email" class="profile-email"></p>
                    <p id="profile-display-dept" class="profile-dept"></p>
                    <div id="profile-display-role" class="profile-role-badge"></div>
                    <button class="btn btn-sm btn-ghost" id="remove-avatar-btn" style="display:none;margin-top:12px"><i class="bi bi-trash"></i> Remove photo</button>
                  </div>
                </div>
                <div class="card">
                  <div class="card-header"><h2>Password</h2></div>
                  <div class="card-body">
                    <form id="password-form">
                      <div class="form-group">
                        <label class="form-label">Current password</label>
                        <input class="form-input" type="password" id="pw-current" required placeholder="Enter current password" />
                      </div>
                      <div class="form-group">
                        <label class="form-label">New password</label>
                        <input class="form-input" type="password" id="pw-new" required minlength="6" placeholder="Min. 6 characters" />
                      </div>
                      <button type="submit" class="btn btn-primary" style="width:100%">Change Password</button>
                    </form>
                  </div>
                </div>
              </div>
              <div class="profile-main">
                <div class="card">
                  <div class="card-header"><h2>Profile Information</h2></div>
                  <div class="card-body">
                    <form id="profile-form">
                      <div class="form-row">
                        <div class="form-group">
                          <label class="form-label">Full name</label>
                          <input class="form-input" id="profile-name" placeholder="Your full name" />
                        </div>
                        <div class="form-group">
                          <label class="form-label">Email address</label>
                          <input class="form-input" id="profile-email" type="email" placeholder="your@email.com" />
                        </div>
                      </div>
                      <div class="form-row">
                        <div class="form-group">
                          <label class="form-label">Phone number</label>
                          <input class="form-input" id="profile-phone" placeholder="+1 (555) 000-0000" />
                        </div>
                        <div class="form-group">
                          <label class="form-label">Job title</label>
                          <input class="form-input" id="profile-job-title" placeholder="e.g. Support Agent" />
                        </div>
                      </div>
                      <div class="form-group">
                        <label class="form-label">Signature</label>
                        <textarea class="form-textarea" id="profile-signature" placeholder="Appears at the bottom of your responses..." style="min-height:70px"></textarea>
                      </div>
                      <button type="submit" class="btn btn-primary">Save Changes</button>
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
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgSrc = e.target.result;
        openModal({
          title: 'Crop Profile Picture',
          content: `
            <div style="text-align:center">
              <div style="position:relative;display:inline-block;max-width:100%;overflow:hidden;border-radius:8px">
                <img id="crop-image" src="${imgSrc}" style="max-width:100%;max-height:50vh;display:block" />
              </div>
              <div style="margin-top:12px;display:flex;gap:12px;justify-content:center;align-items:center">
                <input type="range" id="crop-zoom" min="0.5" max="2" step="0.05" value="1" style="width:120px" />
                <span id="crop-zoom-label" style="font-size:12px;color:var(--text-secondary)">1x</span>
              </div>
              <div class="crop-box" id="crop-box" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:200px;height:200px;border:2px dashed #fff;border-radius:50%;pointer-events:none;box-shadow:0 0 0 9999px rgba(0,0,0,0.5);cursor:move"></div>
            </div>
          `,
          buttons: [
            { text: 'Cancel', class: 'btn', onclick: closeModal },
            { text: 'Upload', class: 'btn btn-primary', onclick: () => {
              const img = document.getElementById('crop-image');
              const zoom = parseFloat(document.getElementById('crop-zoom').value);
              const canvas = document.createElement('canvas');
              const size = 300;
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              const iw = img.naturalWidth * zoom;
              const ih = img.naturalHeight * zoom;
              const cx = img.naturalWidth / 2;
              const cy = img.naturalHeight / 2;
              ctx.drawImage(img, cx - iw/2, cy - ih/2, iw, ih, 0, 0, size, size);
              canvas.toBlob(async (blob) => {
                const fd = new FormData();
                fd.append('avatar', blob, 'avatar.png');
                try {
                  const data = await api.uploadAvatar(fd);
                  showToast('Profile picture updated', 'success');
                  user.avatar = data.avatar;
                  this.updateProfileDisplay(user);
                  syncAvatar(user);
                  closeModal();
                } catch (err) {
                  showToast('Upload failed: ' + err.message, 'error');
                }
              }, 'image/png');
            }}
          ]
        });
        const zoomSlider = document.getElementById('crop-zoom');
        const zoomLabel = document.getElementById('crop-zoom-label');
        if (zoomSlider && zoomLabel) {
          zoomSlider.addEventListener('input', () => {
            zoomLabel.textContent = parseFloat(zoomSlider.value).toFixed(1) + 'x';
            const img = document.getElementById('crop-image');
            if (img) { img.style.transform = 'scale(' + zoomSlider.value + ')'; img.style.transformOrigin = 'center center'; }
          });
        }
      };
      reader.readAsDataURL(file);
      avatarInput.value = '';
    });

    const removeBtn = document.getElementById('remove-avatar-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        try {
          await api.deleteAvatar();
          user.avatar = null;
          this.updateProfileDisplay(user);
          syncAvatar(user);
          showToast('Profile picture removed', 'info');
        } catch (err) {
          showToast('Failed: ' + err.message, 'error');
        }
      });
    }

    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = profileForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-arrow-repeat spinner"></i> Saving...';
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
        syncAvatar(user);
        const dropName = document.getElementById('dropdown-name');
        const dropEmail = document.getElementById('dropdown-email');
        if (dropName) dropName.textContent = user.full_name || user.username;
        if (dropEmail) dropEmail.textContent = user.email || '';
        showToast('Profile updated', 'success');
      } catch (err) {
        showToast('Update failed: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Changes';
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
      avatarEl.innerHTML = `<img src="${user.avatar}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
      avatarEl.style.background = 'none';
      if (removeBtn) removeBtn.style.display = '';
    } else {
      avatarEl.textContent = (user.full_name || 'U')[0].toUpperCase();
      avatarEl.style.background = '';
      if (removeBtn) removeBtn.style.display = 'none';
    }
    document.getElementById('profile-display-name').textContent = user.full_name || '';
    document.getElementById('profile-display-email').textContent = user.email || '';
    const deptEl = document.getElementById('profile-display-dept');
    if (user.department_name) {
      deptEl.textContent = user.department_name + (user.job_title ? ` — ${user.job_title}` : '');
    } else if (user.job_title) {
      deptEl.textContent = user.job_title;
    } else {
      deptEl.textContent = '';
    }
    document.getElementById('profile-display-role').innerHTML = getUserRoleBadge(user.role);
  }
}
