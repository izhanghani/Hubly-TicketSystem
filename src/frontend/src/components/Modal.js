export function openModal({ title, content, buttons, size = '' }) {
  const container = document.getElementById('modal-container');
  const sizeClass = size ? `modal-${size}` : '';

  const btnHtml = (buttons || []).map((b, i) =>
    `<button class="${b.class}" id="modal-btn-${i}">${b.text}</button>`
  ).join('');

  container.innerHTML = `
    <div class="modal-overlay show" id="modal-overlay">
      <div class="modal ${sizeClass}" id="modal-dialog">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">${btnHtml}</div>
      </div>
    </div>
  `;

  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close-btn');

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => { container.innerHTML = ''; }, 200);
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  }, { once: true });

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
    setTimeout(() => { document.getElementById('modal-container').innerHTML = ''; }, 200);
  }
}
