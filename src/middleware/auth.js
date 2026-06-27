// Autorización en servidor (RF-02 / RF-09). No confiar en la UI.
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).send(wantsHtml(req)
      ? renderRedirect()
      : { error: 'No autenticado' });
  }
  next();
}

function requireRole(rol) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).send(wantsHtml(req) ? renderRedirect() : { error: 'No autenticado' });
    }
    if (req.session.user.rol !== rol) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    next();
  };
}

function wantsHtml(req) {
  return req.accepts(['html', 'json']) === 'html';
}

function renderRedirect() {
  return '<!doctype html><meta http-equiv="refresh" content="0;url=/">Redirigiendo… <a href="/">Inicia sesión</a>';
}

module.exports = { requireAuth, requireRole };
