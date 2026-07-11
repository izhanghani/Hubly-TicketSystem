import api from './api.js';
import Sidebar from './components/Sidebar.js';
import { updateFAB } from './main.js';
import LoginPage from './pages/Login.js';
import DashboardPage from './pages/Dashboard.js';
import TicketListPage from './pages/TicketList.js';
import TicketDetailPage from './pages/TicketDetail.js';
import CreateTicketPage from './pages/CreateTicket.js';
import UsersPage from './pages/Users.js';
import AdminSettingsPage from './pages/AdminSettings.js';
import ProfilePage from './pages/Profile.js';

async function applyBranding() {
  try {
    const settings = await api.getSettings();
    const brand = {};
    (settings.branding || []).forEach(s => { brand[s.key] = s.value; });
    const theme = {};
    (settings.theme || []).forEach(s => { theme[s.key] = s.value; });

    if (brand.branding_primary_color) document.documentElement.style.setProperty('--primary', brand.branding_primary_color);
    if (brand.branding_secondary_color) document.documentElement.style.setProperty('--secondary', brand.branding_secondary_color);
    if (theme.theme_sidebar_color) document.documentElement.style.setProperty('--bg-sidebar', theme.theme_sidebar_color);
    if (theme.theme_accent_color) document.documentElement.style.setProperty('--purple', theme.theme_accent_color);

    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) favicon.href = '/api/settings/favicon?' + Date.now();

    const all = [...(settings.general || []), ...(settings.branding || [])];
    const appName = all.find(s => s.key === 'app_name');
    const titleEl = document.getElementById('sidebar-logo-title');
    if (titleEl && appName && appName.value) titleEl.textContent = appName.value;
    const loginTitle = document.querySelector('.login-logo h1');
    if (loginTitle && appName && appName.value && !document.getElementById('login-logo-img')?.querySelector('img')?.complete) loginTitle.textContent = appName.value;
  } catch {}
}

const routes = {
  '/login': { component: LoginPage, public: true },
  '/': { component: DashboardPage, requiresAuth: true },
  '/tickets': { component: TicketListPage, requiresAuth: true },
  '/tickets/new': { component: CreateTicketPage, requiresAuth: true },
  '/tickets/:id': { component: TicketDetailPage, requiresAuth: true },
  '/users': { component: UsersPage, requiresAuth: true, roles: ['admin', 'supervisor'] },
  '/settings': { component: AdminSettingsPage, requiresAuth: true, roles: ['admin'] },
  '/profile': { component: ProfilePage, requiresAuth: true }
};

let currentCleanup = null;

function matchRoute(path) {
  for (const [pattern, config] of Object.entries(routes)) {
    const regex = new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$');
    const match = path.match(regex);
    if (match) {
      const params = {};
      const keys = pattern.match(/:(\w+)/g) || [];
      keys.forEach((key, i) => { params[key.slice(1)] = match[i + 1]; });
      return { ...config, params };
    }
  }
  return null;
}

function nprogress(start) {
  const bar = document.getElementById('nprogress-bar');
  if (!bar) return;
  if (start) {
    bar.style.width = '30%';
    bar.style.transition = 'width 0.3s ease';
  } else {
    bar.style.width = '100%';
    bar.style.transition = 'width 0.15s ease';
    setTimeout(() => { bar.style.width = '0%'; bar.style.transition = 'none'; }, 300);
  }
}

export async function navigate(path) {
  nprogress(true);
  path = path || '/';
  window.history.pushState({}, '', path);
  await render();
  setTimeout(() => nprogress(false), 100);
}

export async function render() {
  const path = window.location.pathname;
  const route = matchRoute(path);
  const token = api.getToken();
  const app = document.getElementById('app');

  if (currentCleanup && typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  if (!route) {
    app.innerHTML = `<div class="error-page"><div class="error-icon error-icon-404"><i class="bi bi-compass"></i></div><h1>404</h1><p>Oops! The page you're looking for doesn't exist. It may have been moved or deleted.</p><div class="error-actions"><button class="btn btn-primary" onclick="window.history.back()"><i class="bi bi-arrow-left"></i> Go Back</button><a href="/" onclick="event.preventDefault();window.appNavigate('/')" class="btn"><i class="bi bi-house"></i> Home</a></div></div>`;
    updateFAB();
    return;
  }

  if (route.public) {
    if (token && path === '/login') { navigate('/'); return; }
    const comp = new route.component();
    app.innerHTML = comp.render();
    if (comp.afterRender) comp.afterRender();
    if (comp.cleanup) currentCleanup = comp.cleanup.bind(comp);
    updateFAB();
    return;
  }

  if (!token) {
    navigate('/login');
    return;
  }

  try {
    const user = await api.getMe();
    if (route.roles && !route.roles.includes(user.role)) {
      app.innerHTML = `<div class="error-page"><div class="error-icon error-icon-404"><i class="bi bi-shield-lock"></i></div><h1>403</h1><p>Access denied. You don't have permission to view this page.</p><div class="error-actions"><a href="/" onclick="event.preventDefault();window.appNavigate('/')" class="btn btn-primary"><i class="bi bi-speedometer2"></i> Go to Dashboard</a><button class="btn" onclick="window.history.back()"><i class="bi bi-arrow-left"></i> Back</button></div></div>`;
      updateFAB();
      return;
    }

    Sidebar.setUser(user);

    const comp = new route.component();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    app.style.opacity = '0';
    app.style.transform = 'translateY(16px)';
    app.style.filter = 'blur(2px)';
    app.innerHTML = comp.render();
    requestAnimationFrame(() => {
      app.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), filter 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      app.style.opacity = '1';
      app.style.transform = 'translateY(0)';
      app.style.filter = 'blur(0)';
    });
    if (comp.afterRender) comp.afterRender(user, route.params);
    if (comp.cleanup) currentCleanup = comp.cleanup.bind(comp);

    applyBranding();
    updateFAB();
  } catch {
    api.setToken(null);
    navigate('/login');
  }
}

window.addEventListener('popstate', () => render());
window.appNavigate = navigate;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    const form = document.querySelector('form');
    if (form) {
      const btn = form.querySelector('button[type="submit"]');
      if (btn) { e.preventDefault(); btn.click(); }
    }
  }
});
