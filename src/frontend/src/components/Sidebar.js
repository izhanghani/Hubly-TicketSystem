import api from '../api.js';

const SIDEBAR_ITEMS = [
  { id: 'dashboard', icon: 'bi-speedometer2', label: 'Dashboard', link: '/', roles: null },
  { id: 'tickets', icon: 'bi-ticket-perforated', label: 'Tickets', link: '/tickets', roles: null },
  { id: 'users', icon: 'bi-people', label: 'Users', link: '/users', roles: ['admin', 'supervisor'] },
  { id: 'settings', icon: 'bi-gear', label: 'Settings', link: '/settings', roles: ['admin'] },
];

const Sidebar = {
  _user: null,

  setUser(user) { this._user = user; },

  render(active) {
    const items = SIDEBAR_ITEMS;

    const navItems = items.map(item => `
      <a href="${item.link}" class="nav-item ${active === item.id ? 'active' : ''}" data-link role="menuitem" data-role="${item.roles ? item.roles.join(',') : '*'}" style="${item.roles && this._user && !item.roles.includes(this._user.role) ? 'display:none' : ''}">
        <i class="bi ${item.icon}"></i>
        <span>${item.label}</span>
      </a>
    `).join('');

    return `
      <aside class="sidebar" id="sidebar" role="navigation">
        <div class="sidebar-logo">
          <div class="logo-icon"><i class="bi bi-ticket-perforated"></i></div>
          <div class="logo-text">
            Hubly
            <small id="company-name-display">Professional</small>
          </div>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section">
            <div class="nav-section-title">Main Menu</div>
            ${navItems}
          </div>
          <div class="nav-section" style="margin-top:auto;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06)">
            <a href="/profile" class="nav-item ${active === 'profile' ? 'active' : ''}" data-link role="menuitem">
              <i class="bi bi-person-circle"></i><span>My Profile</span>
            </a>
          </div>
        </nav>
        <div class="sidebar-footer" id="sidebar-footer">Hubly v2.0</div>
      </aside>
      <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;
  },

  afterRender(user) {
    this._user = user;
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');
    const companyName = document.getElementById('company-name-display');

    // Filter sidebar items by user role
    if (user && sidebar) {
      sidebar.querySelectorAll('.nav-item[data-role]').forEach(el => {
        const roles = el.dataset.role;
        if (roles && roles !== '*') {
          const allowed = roles.split(',');
          if (!allowed.includes(user.role)) {
            el.style.display = 'none';
          }
        }
      });
    }

    if (companyName) {
      try {
        api.getSettings().then(s => {
          const all = [...(s.general || []), ...(s.branding || [])];
          const cn = all.find(x => x.key === 'branding_company_name' || x.key === 'company_name');
          if (cn && cn.value) companyName.textContent = cn.value;
          const ft = all.find(x => x.key === 'branding_footer_text');
          const footer = document.getElementById('sidebar-footer');
          if (footer && ft && ft.value) footer.textContent = ft.value + ' v2.0';
        }).catch(() => {});
      } catch {}
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }
  }
};

export default Sidebar;
