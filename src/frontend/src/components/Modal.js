let modalEscHandler = null;

export function openModal({ title, content, buttons, size = '' }) {
  const container = document.getElementById('modal-container');
  const sizeClass = size ? `modal-${size}` : '';

  const btnHtml = (buttons || []).map((b, i) =>
    `<button class="${b.class}" id="modal-btn-${i}">${b.text}</button>`
  ).join('');

  container.innerHTML = `
    <div class="modal-overlay show" id="modal-overlay" role="presentation">
      <div class="modal ${sizeClass}" id="modal-dialog" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" id="modal-close-btn" aria-label="Close"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">${btnHtml}</div>
      </div>
    </div>
  `;

  const overlay = document.getElementById('modal-overlay');
  const dialog = document.getElementById('modal-dialog');
  const closeBtn = document.getElementById('modal-close-btn');

  const close = () => {
    overlay.classList.remove('show');
    if (modalEscHandler) {
      document.removeEventListener('keydown', modalEscHandler);
      modalEscHandler = null;
    }
    setTimeout(() => { container.innerHTML = ''; }, 200);
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  modalEscHandler = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', modalEscHandler);

  // Focus trap
  const focusable = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length > 0) {
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();

    dialog.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  (buttons || []).forEach((b, i) => {
    const btn = document.getElementById(`modal-btn-${i}`);
    if (btn && b.onclick) {
      btn.addEventListener('click', b.onclick);
    }
  });

  return close;
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('show');
    if (modalEscHandler) {
      document.removeEventListener('keydown', modalEscHandler);
      modalEscHandler = null;
    }
    setTimeout(() => { document.getElementById('modal-container').innerHTML = ''; }, 200);
  }
}
