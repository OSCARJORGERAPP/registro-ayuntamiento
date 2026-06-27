function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

function layout(title, body, user) {
  const nav = user
    ? `<span>${esc(user.email)} · <b>${esc(user.rol)}</b></span>`
      + ' <form method="post" action="/auth/logout" style="display:inline">'
      + '<button>Salir</button></form>'
    : '<a href="/">Acceder</a>';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${esc(title)} · Registro Municipal</title><style>`
    + `body{font-family:system-ui,Segoe UI,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#1a1a1a;line-height:1.5}`
    + `header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ddd;padding-bottom:.5rem;margin-bottom:1rem;gap:1rem;flex-wrap:wrap}`
    + `a{color:#4a90e2}label{display:block;margin:.6rem 0 .2rem;font-weight:600}`
    + `input,textarea,select{width:100%;padding:.5rem;border:1px solid #ccc;border-radius:4px;font:inherit;box-sizing:border-box}`
    + `button{background:#4a90e2;color:#fff;border:0;padding:.5rem 1rem;border-radius:4px;cursor:pointer;font:inherit}`
    + `table{border-collapse:collapse;width:100%}td,th{border:1px solid #eee;padding:.4rem .6rem;text-align:left}`
    + `.card{border:1px solid #eee;border-radius:6px;padding:1rem;margin:.6rem 0}small{color:#666}`
    + `</style></head><body><header><a href="/"><b>🏛️ Registro Municipal</b></a><div>${nav}</div></header>`
    + `${body}</body></html>`;
}

function info(title, message, user) {
  return layout(title, `<h1>${esc(title)}</h1><p>${message}</p><p><a href="/">Volver al inicio</a></p>`, user);
}

module.exports = { layout, info, esc };
