import { render, navigate } from './router.js';

window.appNavigate = navigate;

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link]');
  if (link) {
    e.preventDefault();
    navigate(link.getAttribute('href'));
  }
});

function hideSplash() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => { splash.style.display = 'none'; }, 500);
  }
}

function setupFAB() {
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.id = 'fab-btn';
  fab.innerHTML = '<i class="bi bi-plus-lg"></i>';
  fab.title = 'Create Ticket (Ctrl+N)';
  fab.style.display = 'none';
  fab.addEventListener('click', () => navigate('/tickets/new'));
  document.body.appendChild(fab);
}

export function updateFAB() {
  const fab = document.getElementById('fab-btn');
  if (!fab) return;
  const path = window.location.pathname;
  const hideOn = ['/login', '/register'];
  fab.style.display = hideOn.includes(path) ? 'none' : '';
}

function setupBackToTop() {
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.id = 'back-to-top';
  btn.innerHTML = '<i class="bi bi-chevron-up"></i>';
  btn.title = 'Back to top';
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const observer = new IntersectionObserver(
    ([entry]) => {
      btn.classList.toggle('visible', !entry.isIntersecting);
    },
    { threshold: 0, rootMargin: '0px 0px -100px 0px' }
  );

  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none';
  document.body.prepend(sentinel);
  observer.observe(sentinel);

  document.body.appendChild(btn);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    hideSplash();
    setupFAB();
    setupBackToTop();
    render();
  });
} else {
  hideSplash();
  setupFAB();
  setupBackToTop();
  render();
}
