/*
 * RPG Manager — autenticação centralizada.
 * Todas as rotas usam os mesmos critérios para validar o cookie rpg_session.
 */
const SESSION_COOKIE = 'rpg_session';
const SESSION_DAYS = 14;

function parseCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index > 0) cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    return cookies;
  }, {});
}

function getSessionUser(db, req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const row = db.get(`
    SELECT s.id AS sessionId, s.userId, s.expiresAt, u.name, u.email, u.createdAt
    FROM sessions s JOIN users u ON u.id = s.userId
    WHERE s.id = ? AND datetime(s.expiresAt) > datetime('now')
  `, [token]);
  return row ? { id: row.userId, name: row.name, email: row.email, createdAt: row.createdAt, sessionId: row.sessionId } : null;
}

function attachUser(db) {
  return (req, res, next) => {
    req.user = getSessionUser(db, req);
    next();
  };
}

function requireUser(db) {
  return (req, res, next) => {
    req.user = getSessionUser(db, req);
    if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.', code: 'AUTH_REQUIRED' });
    next();
  };
}

function setSessionCookie(res, token, maxAge = SESSION_DAYS * 86400) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
}

function clearSessionCookie(res) { setSessionCookie(res, '', 0); }

module.exports = { SESSION_COOKIE, SESSION_DAYS, parseCookies, getSessionUser, attachUser, requireUser, setSessionCookie, clearSessionCookie };
