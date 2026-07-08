import api from './api.js';
import Sidebar from './components/Sidebar.js';
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

export async function navigate(path) {
  path = path || '/';
  window.history.pushState({}, '', path);
  await render();
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
    app.innerHTML = `<div class="error-page"><h1>404</h1><p>Page not found</p><button onclick="window.history.back()">Go Back</button></div>`;
    return;
  }

  if (route.public) {
    if (token && path === '/login') { navigate('/'); return; }
    const comp = new route.component();
    app.innerHTML = comp.render();
    if (comp.afterRender) comp.afterRender();
    if (comp.cleanup) currentCleanup = comp.cleanup.bind(comp);
    return;
  }

  if (!token) {
    navigate('/login');
    return;
  }

  try {
    const user = await api.getMe();
    if (route.roles && !route.roles.includes(user.role)) {
      app.innerHTML = `<div class="error-page"><h1>403</h1><p>Access denied. Insufficient permissions.</p><a href="/" onclick="event.preventDefault();window.appNavigate('/')">Go to Dashboard</a></div>`;
      return;
    }

    Sidebar.setUser(user);

    const comp = new route.component();
    app.innerHTML = comp.render();
    if (comp.afterRender) comp.afterRender(user, route.params);
    if (comp.cleanup) currentCleanup = comp.cleanup.bind(comp);

    applyBranding();
  } catch {
    api.setToken(null);
    navigate('/login');
  }
}

window.addEventListener('popstate', () => render());
window.appNavigate = navigate;
