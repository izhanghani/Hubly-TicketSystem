const MAX_TOASTS = 5;

export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  while (container.children.length >= MAX_TOASTS) {
    const first = container.firstElementChild;
    first.classList.remove('show');
    setTimeout(() => first.remove(), 300);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  const icons = { success: 'bi-check-circle-fill', error: 'bi-exclamation-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
  toast.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span style="flex:1">${message}</span><button style="background:none;border:none;color:var(--text-light);padding:0;font-size:16px;cursor:pointer;line-height:1;flex-shrink:0;opacity:0.6" class="toast-dismiss">&times;</button>`;
  toast.style.cursor = 'default';
  container.appendChild(toast);

  const progress = document.createElement('div');
  progress.style.cssText = 'position:absolute;bottom:0;left:0;height:3px;background:currentColor;border-radius:0 0 12px 12px;transition:width linear;opacity:0.5';
  toast.style.position = 'relative';
  toast.style.overflow = 'hidden';
  toast.appendChild(progress);

  requestAnimationFrame(() => {
    toast.classList.add('show');
    progress.style.width = '100%';
    requestAnimationFrame(() => {
      progress.style.width = '0%';
      progress.style.transitionDuration = duration + 'ms';
    });
  });

  const dismiss = () => {
    clearTimeout(timeout);
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  };

  let timeout = setTimeout(dismiss, duration);

  toast.querySelector('.toast-dismiss').addEventListener('click', (e) => {
    e.stopPropagation();
    dismiss();
  });

  toast.addEventListener('mouseenter', () => {
    clearTimeout(timeout);
    progress.style.transitionDuration = '0ms';
    progress.style.width = progress.getBoundingClientRect().width / toast.getBoundingClientRect().width * 100 + '%';
  });

  toast.addEventListener('mouseleave', () => {
    const remaining = parseFloat(progress.style.width) || 0;
    const remainingTime = (remaining / 100) * duration;
    progress.style.transitionDuration = remainingTime + 'ms';
    progress.style.width = '0%';
    timeout = setTimeout(dismiss, remainingTime);
  });
}
