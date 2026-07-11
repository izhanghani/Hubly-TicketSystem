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
            <input type="text" placeholder="Search tickets by ID or title..." id="global-search" title="Search tickets (press / to focus)" autocomplete="off" />
            <span class="search-hint"><span class="kbd">/</span></span>
          </div>
          <button class="header-btn" id="theme-toggle" title="Toggle theme (dark/light)"><i class="bi bi-moon-stars"></i></button>
          <button class="header-btn" id="notif-btn" title="Notifications (Ctrl+Shift+N)" style="position:relative">
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
        <div class="notif-panel" id="notif-panel">
          <div class="notif-panel-header">
            <span style="font-weight:600">Notifications</span>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="btn btn-sm btn-ghost" id="mark-all-read-btn" style="font-size:12px;display:none">Mark all read</button>
              <button class="btn btn-sm btn-ghost" id="notif-close-btn" style="font-size:14px;padding:2px 6px"><i class="bi bi-x-lg"></i></button>
            </div>
          </div>
          <div class="notif-panel-body" id="notif-list">
            <div style="text-align:center;padding:20px;color:var(--text-secondary)">Loading...</div>
          </div>
        </div>
      </header>
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
        if (user.avatar) {
          avatarEl.innerHTML = `<img src="${user.avatar}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
          avatarEl.style.background = 'none';
        } else {
          avatarEl.textContent = (user.full_name || user.username || 'U')[0].toUpperCase();
          avatarEl.style.background = '';
        }
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
      const handler = () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('show');
      };
      mobileBtn.addEventListener('click', handler);
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar?.classList.remove('open');
        overlay.classList.remove('show');
      });
    }

    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          if (searchInput.value.trim()) {
            navigate(`/tickets?search=${encodeURIComponent(searchInput.value.trim())}`);
          }
        }, 500);
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
          clearTimeout(searchTimeout);
          navigate(`/tickets?search=${encodeURIComponent(searchInput.value.trim())}`);
        }
      });
    }

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark ? '1' : '0');
        themeBtn.querySelector('i').className = isDark ? 'bi bi-sun' : 'bi bi-moon-stars';
      });

      const saved = localStorage.getItem('darkMode');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const useDark = saved === '1' || (saved === null && prefersDark);

      document.body.classList.toggle('dark-mode', useDark);
      themeBtn.querySelector('i').className = useDark ? 'bi bi-sun' : 'bi bi-moon-stars';
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

    const getDateGroup = (dateStr) => {
      if (!dateStr) return 'Unknown';
      const d = new Date(dateStr);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 6);

      if (d >= today) return 'Today';
      if (d >= yesterday) return 'Yesterday';
      if (d >= weekStart) return 'This Week';
      return 'Earlier';
    };

    const getNotifIcon = (type) => {
      const icons = {
        warning: { icon: 'bi-exclamation-triangle-fill', bg: 'var(--warning-light)', color: 'var(--warning)' },
        success: { icon: 'bi-check-circle-fill', bg: 'var(--success-light)', color: 'var(--success)' },
        error: { icon: 'bi-x-circle-fill', bg: 'var(--danger-light)', color: 'var(--danger)' },
        info: { icon: 'bi-info-circle-fill', bg: 'var(--info-light)', color: 'var(--info)' },
        ticket: { icon: 'bi-ticket-fill', bg: 'var(--primary-light)', color: 'var(--primary)' },
        assign: { icon: 'bi-person-plus-fill', bg: 'var(--purple-light)', color: 'var(--purple)' },
      };
      return icons[type] || { icon: 'bi-info-circle-fill', bg: 'var(--primary-light)', color: 'var(--primary)' };
    };

    const loadNotifications = async () => {
      try {
        const data = await api.getNotifications();
        const notifs = data.notifications || [];
        const markAllBtn = document.getElementById('mark-all-read-btn');
        if (markAllBtn) markAllBtn.style.display = notifs.length > 0 ? 'inline-flex' : 'none';

        if (notifs.length === 0) {
          list.innerHTML = `
            <div class="notif-empty">
              <i class="bi bi-bell-slash"></i>
              <div class="notif-empty-title">No notifications</div>
              <div class="notif-empty-desc">You're all caught up!</div>
            </div>`;
          return;
        }

        const groups = {};
        notifs.forEach(n => {
          const group = getDateGroup(n.created_at);
          if (!groups[group]) groups[group] = [];
          groups[group].push(n);
        });

        const groupOrder = ['Today', 'Yesterday', 'This Week', 'Earlier', 'Unknown'];
        let html = '';
        groupOrder.forEach(g => {
          if (!groups[g]) return;
          html += `<div class="notif-group"><div class="notif-group-label">${g}</div>`;
          groups[g].forEach(n => {
            const ico = getNotifIcon(n.type);
            const isUnread = !n.is_read;
            html += `
              <div class="notif-item ${isUnread ? 'unread' : ''}" data-id="${n.id}">
                <div class="notif-icon" style="background:${ico.bg};color:${ico.color}"><i class="bi ${ico.icon}"></i></div>
                <div class="notif-content">
                  <div class="notif-text" style="${isUnread ? 'font-weight:600' : ''}">${n.title}</div>
                  ${n.message ? `<div class="notif-desc">${n.message}</div>` : ''}
                  <div class="notif-time">${timeSince(n.created_at)}</div>
                </div>
                ${isUnread ? '<div class="notif-dot"></div>' : ''}
              </div>`;
          });
          html += '</div>';
        });
        list.innerHTML = html;

        list.querySelectorAll('.notif-item').forEach(el => {
          el.addEventListener('click', async () => {
            const id = el.dataset.id;
            if (id && el.classList.contains('unread')) {
              try { await api.markNotificationRead(id); } catch {}
              el.classList.remove('unread');
              el.querySelector('.notif-text')?.style.removeProperty('font-weight');
              el.querySelector('.notif-dot')?.remove();
              loadUnread();
            }
          });
        });
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

    const closeBtn = document.getElementById('notif-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.remove('show'));

    const markAllBtn = document.getElementById('mark-all-read-btn');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        try {
          await api.markAllNotificationsRead();
          list.querySelectorAll('.notif-item.unread').forEach(el => {
            el.classList.remove('unread');
            el.querySelector('.notif-text')?.style.removeProperty('font-weight');
            el.querySelector('.notif-dot')?.remove();
          });
          badge.style.display = 'none';
          markAllBtn.style.display = 'none';
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
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.classList.remove('show');
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
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span><kbd class="kbd">Ctrl+N</kbd></span><span style="font-size:13px;color:var(--text-secondary)">New Ticket</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span><kbd class="kbd">Ctrl+T</kbd></span><span style="font-size:13px;color:var(--text-secondary)">Tickets List</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span><kbd class="kbd">Ctrl+D</kbd></span><span style="font-size:13px;color:var(--text-secondary)">Dashboard</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span><kbd class="kbd">/</kbd></span><span style="font-size:13px;color:var(--text-secondary)">Focus Search</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span><kbd class="kbd">Ctrl+Shift+N</kbd></span><span style="font-size:13px;color:var(--text-secondary)">Notifications</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0"><span><kbd class="kbd">?</kbd></span><span style="font-size:13px;color:var(--text-secondary)">Show Shortcuts</span></div>
      </div>
    `,
    buttons: [{ text: 'Close', class: 'btn btn-primary', onclick: closeModal }]
  });
}

export function syncAvatar(user) {
  const avatarEl = document.getElementById('header-avatar');
  if (!avatarEl) return;
  if (user.avatar) {
    avatarEl.innerHTML = `<img src="${user.avatar}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
    avatarEl.style.background = 'none';
  } else {
    avatarEl.textContent = (user.full_name || user.username || 'U')[0].toUpperCase();
    avatarEl.style.background = '';
  }
}

export default Header;
