const toggle = document.querySelector('#app-mobile-toggle');
const status = document.querySelector('#app-preview-status');
toggle.addEventListener('click', () => {
  const mobile = document.body.classList.toggle('is-mobile-preview');
  toggle.textContent = mobile ? 'Desktop view' : 'Mobile view';
  toggle.setAttribute('aria-pressed', String(mobile));
  status.textContent = mobile ? 'Phone layout preview. Your current trip and form entries are preserved.' : 'Desktop layout preview.';
});
