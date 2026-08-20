/* RPG Manager — CTA de autenticação compartilhado entre todas as telas. */
(() => {
  const currentPath = `${location.pathname}${location.search}`;
  const loginUrl = `login.html?next=${encodeURIComponent(currentPath)}`;
  const slots = [...document.querySelectorAll('[data-auth-slot]')];
  if (!slots.length) return;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }
  function renderLoggedOut() {
    slots.forEach(slot => { slot.innerHTML = `<a class="auth-cta auth-login" href="${loginUrl}">Entrar na conta <span>↗</span></a>`; });
  }
  function renderLoggedIn(user) {
    slots.forEach(slot => {
      slot.innerHTML = `<span class="auth-user"><small>SESSÃO ATIVA</small><strong>${escapeHtml(user.name || user.email)}</strong></span><button type="button" class="auth-cta auth-logout">Sair</button>`;
      slot.querySelector('.auth-logout')?.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        location.href = `login.html?next=${encodeURIComponent(currentPath)}`;
      });
    });
  }
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(async response => ({ ok: response.ok, body: await response.json().catch(() => ({})) }))
    .then(({ ok, body }) => ok && body.user ? renderLoggedIn(body.user) : renderLoggedOut())
    .catch(renderLoggedOut);
})();
