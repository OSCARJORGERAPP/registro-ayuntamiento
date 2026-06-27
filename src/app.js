const express = require('express');
const session = require('express-session');
const config = require('./config');
const { layout, info, esc } = require('./views/render');
const { requireRole } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const presentacionesRoutes = require('./routes/presentaciones');
const expedientesRoutes = require('./routes/expedientes');
const presentaciones = require('./domain/presentaciones');
const expedientes = require('./domain/expedientes');
const metrics = require('./metrics');

const COLECCIONES_METRICAS = ['areas', 'usuarios', 'presentaciones', 'expedientes', 'actuaciones', 'magic_tokens'];

// Tamaño de los objetos almacenados por colección (bytes/doc y almacenamiento).
async function tamanosColecciones(db) {
  const out = {};
  for (const c of COLECCIONES_METRICAS) {
    try {
      const s = await db.command({ collStats: c });
      out[c] = { docs: s.count || 0, avg_obj_bytes: s.avgObjSize || 0, storage_bytes: s.storageSize || 0 };
    } catch {
      out[c] = { docs: 0, avg_obj_bytes: 0, storage_bytes: 0 };
    }
  }
  return out;
}

// Fábrica de la app: recibe `db` para poder testear sin red.
function createApp(db) {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.env === 'production' },
  }));

  // Mide la latencia de cada petición (excepto /metrics, para no medirse a sí mismo).
  app.use((req, res, next) => {
    if (req.path === '/metrics') return next();
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      metrics.recordHttp(req.method, req.path, Number(process.hrtime.bigint() - t0) / 1e6, res.statusCode);
    });
    next();
  });

  // Health check: no requiere base de datos (sirve para smoke tests y CI).
  app.get('/health', (req, res) => res.json({ status: 'ok', db: Boolean(db) }));

  // Observabilidad (PROMPT.md §8): latencias por ruta, ops Mongo, proceso y tamaños.
  app.get('/metrics', async (req, res, next) => {
    try {
      const snap = metrics.snapshot();
      if (db) snap.datos = await tamanosColecciones(db);
      res.json(snap);
    } catch (err) { next(err); }
  });

  // Landing / sede electrónica (RF-01 acceso, RF-09/10 áreas).
  app.get('/', async (req, res, next) => {
    try {
      const areas = db ? await db.collection('areas').find({ activo: { $ne: false } }).toArray() : [];
      const lista = areas.map((a) => `<li><a href="/area/${esc(a.codigo)}"><b>${esc(a.nombre)}</b></a> <small>(${esc(a.codigo)})</small></li>`).join('')
        || '<li>Aún no hay áreas configuradas. Ejecuta <code>npm run seed</code>.</li>';
      res.send(layout('Inicio', `
        <h1>Sede electrónica</h1>
        <p>Presenta tus documentos y sigue su tramitación.</p>
        <h2>Áreas de gestión</h2><ul>${lista}</ul>
        <h2>Acceso por enlace mágico</h2>
        <form method="post" action="/auth/magic-link">
          <label for="email">Tu email</label>
          <input id="email" name="email" type="email" required placeholder="nombre@ejemplo.com">
          <p><button type="submit">Enviar enlace de acceso</button></p>
        </form>`, req.session.user));
    } catch (err) { next(err); }
  });

  // RF-10: home personalizable por área de gestión.
  app.get('/area/:codigo', async (req, res, next) => {
    try {
      const area = db ? await db.collection('areas').findOne({ codigo: String(req.params.codigo).toUpperCase() }) : null;
      if (!area) return res.status(404).send(info('Área no encontrada', 'No existe esa área de gestión.', req.session.user));
      const cfg = area.config_home || {};
      const funcionarios = await db.collection('usuarios').find({ rol: 'funcionario', areas: area._id }).toArray();
      const lista = funcionarios.map((f) => `<li>${esc(f.nombre)}</li>`).join('') || '<li>Sin funcionarios asignados.</li>';
      res.send(layout(`Área ${area.nombre}`, `
        <h1 style="color:${esc(cfg.color || '#1a1a1a')}">${esc(cfg.titulo || area.nombre)}</h1>
        <p>Área de gestión <b>${esc(area.codigo)}</b>.</p>
        <h2>Funcionarios que la operan</h2><ul>${lista}</ul>
        <p><a href="/">← Sede electrónica</a></p>`, req.session.user));
    } catch (err) { next(err); }
  });

  app.use('/auth', authRoutes(db));
  app.use('/presentaciones', presentacionesRoutes(db));
  app.use('/expedientes', expedientesRoutes(db));

  // Panel del funcionario (RF-05): presentaciones y expedientes de sus áreas.
  app.get('/funcionario', requireRole('funcionario'), async (req, res, next) => {
    try {
      const areaIds = req.session.user.areas;
      const pres = await presentaciones.listarPorArea(db, areaIds);
      const exps = await expedientes.listarPorArea(db, areaIds);
      const filasP = pres.map((p) => `<tr><td><a href="/presentaciones/${p._id}">${esc(p.numeroRegistro)}</a></td>`
        + `<td>${esc(p.interesado.nombre)}</td><td>${esc(p.solicita).slice(0, 50)}</td>`
        + `<td>${new Date(p.fechaEntrada).toLocaleDateString('es-ES')}</td></tr>`).join('')
        || '<tr><td colspan="4">Sin presentaciones.</td></tr>';
      const filasE = exps.map((e) => `<tr><td><a href="/expedientes/${e._id}">${esc(e.codigo)}</a></td>`
        + `<td>${esc(e.tipo)}</td><td>${new Date(e.fechaCreacion).toLocaleDateString('es-ES')}</td></tr>`).join('')
        || '<tr><td colspan="3">Sin expedientes.</td></tr>';
      res.send(layout('Panel del funcionario', `
        <h1>Panel del funcionario</h1>
        <h2>Presentaciones recibidas</h2>
        <table><tr><th>Nº registro</th><th>Interesado</th><th>Solicita</th><th>Fecha</th></tr>${filasP}</table>
        <h2>Expedientes</h2>
        <table><tr><th>Código</th><th>Tipo</th><th>Creación</th></tr>${filasE}</table>`, req.session.user));
    } catch (err) { next(err); }
  });

  // 404 y manejador de errores.
  app.use((req, res) => res.status(404).send(info('No encontrado', 'La página no existe.', req.session.user)));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send(info('Error', 'Ha ocurrido un error inesperado.', req.session && req.session.user));
  });

  return app;
}

module.exports = { createApp };
