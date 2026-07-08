import api from '../api.js';
import { navigate } from '../router.js';
import { showToast } from './Toast.js';
import { openModal, closeModal } from './Modal.js';

const Header = {
  _notifInterval: null,

  render() {
    return `
      <header class="header">
        <div class="header-left">
          <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle menu"><i class="bi bi-list"></i></button>
          <h1 id="page-title">Dashboard</h1>
        </div>
        <div class="header-right">
          <div class="header-search">
            <i class="bi bi-search"></i>
            <input type="text" placeholder="Search tickets by ID or title..." id="global-search" />
          </div>
          <button class="header-btn" id="theme-toggle" title="Toggle theme"><i class="bi bi-moon-stars"></i></button>
          <button class="header-btn" id="notif-btn" title="Notifications" style="position:relative">
            <i class="bi bi-bell"></i>
            <span id="notif-badge" class="notif-badge" style="display:none">0</span>
          </button>
          <div class="header-btn" id="kbd-shortcuts-btn" title="Keyboard shortcuts (?)" style="cursor:pointer;font-size:14px;font-weight:700;width:auto;padding:0 10px">?</div>
          <div class="user-menu" id="user-menu">
            <div class="user-avatar" id="header-avatar">U</div>
            <div class="user-info">
              <div class="name" id="header-name">User</div>
              <div class="role" id="header-role">Role</div>
            </div>
            <div class="dropdown-menu" id="user-dropdown">
              <div style="padding:12px 14px;border-bottom:1px solid var(--border);margin-bottom:4px">
                <div style="font-weight:600;font-size:14px" id="dropdown-name">User</div>
                <div style="font-size:12px;color:var(--text-secondary)" id="dropdown-email">email</div>
              </div>
              <button class="dropdown-item" onclick="appNavigate('/profile')">
                <i class="bi bi-person-circle"></i> My Profile
              </button>
              <button class="dropdown-item" onclick="appNavigate('/settings')">
                <i class="bi bi-gear"></i> Settings
              </button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item text-danger" id="logout-btn">
                <i class="bi bi-box-arrow-right"></i> Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>
      <div class="notif-panel" id="notif-panel">
        <div class="notif-panel-header">
          <span style="font-weight:600">Notifications</span>
          <button class="btn btn-sm btn-ghost" id="mark-all-read-btn" style="font-size:12px">Mark all read</button>
        </div>
        <div class="notif-panel-body" id="notif-list">
          <div style="text-align:center;padding:20px;color:var(--text-secondary)">Loading...</div>
        </div>
      </div>
    `;
  },

  afterRender(user, title) {
    if (title) {
      const el = document.getElementById('page-title');
      if (el) el.textContent = title;
    }

    const nameEl = document.getElementById('header-name');
    const roleEl = document.getElementById('header-role');
    const avatarEl = document.getElementById('header-avatar');
    const dropName = document.getElementById('dropdown-name');
    const dropEmail = document.getElementById('dropdown-email');

    if (user) {
      if (nameEl) nameEl.textContent = user.full_name || user.username;
      if (roleEl) {
        const labels = { admin: 'Administrator', agent: 'Support Agent', supervisor: 'Supervisor', user: 'User' };
        roleEl.textContent = labels[user.role] || user.role;
      }
      if (avatarEl) {
        avatarEl.textContent = (user.full_name || user.username || 'U')[0].toUpperCase();
      }
      if (dropName) dropName.textContent = user.full_name || user.username;
      if (dropEmail) dropEmail.textContent = user.email || '';
    }

    const userMenu = document.getElementById('user-menu');
    const dropdown = document.getElementById('user-dropdown');
    if (userMenu) {
      const toggle = () => dropdown.classList.toggle('show');
      userMenu.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
      document.addEventListener('click', () => dropdown.classList.remove('show'));
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        api.setToken(null);
        showToast('Signed out successfully', 'info');
        navigate('/login');
      });
    }

    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('show');
      });
    }

    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
          navigate(`/tickets?search=${encodeURIComponent(searchInput.value.trim())}`);
        }
      });
    }

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark);
        themeBtn.querySelector('i').className = isDark ? 'bi bi-sun' : 'bi bi-moon-stars';
      });
      if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        themeBtn.querySelector('i').className = 'bi bi-sun';
      }
    }

    this.setupNotifications(user);
    this.setupKeyboardShortcuts();
  },

  setupNotifications(user) {
    const notifBtn = document.getElementById('notif-btn');
    const badge = document.getElementById('notif-badge');
    const panel = document.getElementById('notif-panel');
    const list = document.getElementById('notif-list');

    if (!notifBtn) return;

    const loadUnread = async () => {
      try {
        const data = await api.getUnreadCount();
        if (data.count > 0) {
          badge.style.display = 'flex';
          badge.textContent = data.count > 99 ? '99+' : data.count;
        } else {
          badge.style.display = 'none';
        }
      } catch {}
    };

    const loadNotifications = async () => {
      try {
        const data = await api.getNotifications();
        list.innerHTML = data.notifications.length === 0
          ? '<div style="text-align:center;padding:30px;color:var(--text-secondary)"><i class="bi bi-bell-slash" style="font-size:32px;display:block;margin-bottom:8px"></i>No notifications</div>'
          : data.notifications.map(n => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
              <div class="notif-icon"><i class="bi ${n.type === 'warning' ? 'bi-exclamation-triangle' : n.type === 'success' ? 'bi-check-circle' : 'bi-info-circle'}"></i></div>
              <div class="notif-content">
                <div class="notif-text">${n.title}</div>
                ${n.message ? `<div class="notif-desc">${n.message}</div>` : ''}
                <div class="notif-time">${timeSince(n.created_at)}</div>
              </div>
              ${n.is_read ? '' : '<div class="notif-dot"></div>'}
            </div>`).join('');
        if (data.notifications.length > 0) {
          list.querySelectorAll('.notif-item').forEach(el => {
            el.addEventListener('click', async () => {
              const id = el.dataset.id;
              if (id) {
                try { await api.markNotificationRead(id); } catch {}
                el.classList.remove('unread');
                loadUnread();
              }
            });
          });
        }
      } catch {}
    };

    loadUnread();
    if (this._notifInterval) clearInterval(this._notifInterval);
    this._notifInterval = setInterval(loadUnread, 30000);

    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = panel.classList.contains('show');
      document.querySelectorAll('.notif-panel.show').forEach(p => p.classList.remove('show'));
      if (!isOpen) {
        panel.classList.add('show');
        loadNotifications();
      } else {
        panel.classList.remove('show');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.notif-panel') && !e.target.closest('#notif-btn')) {
        panel.classList.remove('show');
      }
    });

    const markAllBtn = document.getElementById('mark-all-read-btn');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        try {
          await api.markAllNotificationsRead();
          document.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
          badge.style.display = 'none';
          showToast('All notifications marked as read', 'info');
        } catch {}
      });
    }
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '?') {
        e.preventDefault();
        showKeyboardShortcuts();
      }
      if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        navigate('/tickets/new');
      }
      if (e.key === 't' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        navigate('/tickets');
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        navigate('/');
      }
      if (e.key === '/') {
        e.preventDefault();
        const search = document.getElementById('global-search');
        if (search) search.focus();
      }
      if (e.key === 'Escape') {
        const panel = document.getElementById('notif-panel');
        if (panel) panel.classList.remove('show');
      }
    });

    const btn = document.getElementById('kbd-shortcuts-btn');
    if (btn) btn.addEventListener('click', showKeyboardShortcuts);
  }
};

function timeSince(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function showKeyboardShortcuts() {
  openModal({
    title: 'Keyboard Shortcuts',
    size: 'sm',
    content: `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span>Ctrl+N</span><kbd class="kbd">New Ticket</kbd></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span>Ctrl+T</span><kbd class="kbd">Tickets List</kbd></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span>Ctrl+D</span><kbd class="kbd">Dashboard</kbd></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span>?</span><kbd class="kbd">Show shortcuts</kbd></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0"><span>/</span><kbd class="kbd">Focus search</kbd></div>
      </div>
    `,
    buttons: [{ text: 'Close', class: 'btn btn-primary', onclick: closeModal }]
  });
}

export default Header;
