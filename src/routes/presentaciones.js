const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { layout, info, esc } = require('../views/render');
const config = require('../config');
const dom = require('../domain/presentaciones');
const expedientes = require('../domain/expedientes');

module.exports = function presentacionesRoutes(db) {
  const router = express.Router();
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const upload = multer({ dest: config.uploadsDir, limits: { fileSize: config.maxUploadMb * 1024 * 1024 } });

  // RF-04: el contribuyente ve SOLO sus presentaciones.
  router.get('/mias', requireAuth, async (req, res, next) => {
    try {
      const items = await dom.listarPorContribuyente(db, req.session.user.id);
      const filas = items.map((p) => `<tr>`
        + `<td><a href="/presentaciones/${p._id}">${esc(p.numeroRegistro)}</a></td>`
        + `<td>${esc(p.solicita).slice(0, 60)}</td>`
        + `<td>${new Date(p.fechaEntrada).toLocaleDateString('es-ES')}</td>`
        + `<td>${esc(p.estado)}</td></tr>`).join('') || '<tr><td colspan="4">Aún no has presentado nada.</td></tr>';
      res.send(layout('Mis presentaciones',
        `<h1>Mis presentaciones</h1><p><a href="/presentaciones/nueva">➕ Nueva instancia general</a></p>`
        + `<table><tr><th>Nº registro</th><th>Solicita</th><th>Fecha</th><th>Estado</th></tr>${filas}</table>`,
        req.session.user));
    } catch (err) { next(err); }
  });

  // RF-03: formulario de instancia general.
  router.get('/nueva', requireAuth, async (req, res, next) => {
    try {
      const areas = await db.collection('areas').find({ activo: { $ne: false } }).toArray();
      const opciones = areas.map((a) => `<option value="${a._id}">${esc(a.nombre)}</option>`).join('');
      res.send(layout('Nueva instancia general', `
        <h1>Instancia general</h1>
        <form method="post" action="/presentaciones" enctype="multipart/form-data">
          <label>Área de gestión</label>
          <select name="areaId" required>${opciones}</select>
          <label>Nombre del interesado</label>
          <input name="interesadoNombre" required value="${esc(req.session.user.nombre)}">
          <label>Dirección fiscal del interesado</label>
          <input name="interesadoDireccion" required>
          <label>Nombre del representante (opcional)</label>
          <input name="representante">
          <label>EXPONE</label>
          <textarea name="expone" rows="4" required></textarea>
          <label>SOLICITA</label>
          <textarea name="solicita" rows="4" required></textarea>
          <label>Adjuntos (opcional)</label>
          <input type="file" name="adjuntos" multiple>
          <p><button type="submit">Presentar</button></p>
        </form>`, req.session.user));
    } catch (err) { next(err); }
  });

  // RF-03: registrar la presentación.
  router.post('/', requireAuth, upload.array('adjuntos', 10), async (req, res, next) => {
    try {
      const b = req.body;
      if (!b.interesadoNombre || !b.interesadoDireccion || !b.expone || !b.solicita) {
        return res.status(400).send(info('Faltan datos', 'Completa los campos obligatorios.', req.session.user));
      }
      const adjuntos = (req.files || []).map((f) => ({
        nombre: f.originalname, ruta: f.path, mime: f.mimetype, tamano: f.size,
      }));
      const pres = await dom.crearPresentacion(db, {
        contribuyenteId: req.session.user.id,
        areaId: b.areaId || null,
        interesado: { nombre: b.interesadoNombre, direccionFiscal: b.interesadoDireccion },
        representante: b.representante || null,
        expone: b.expone,
        solicita: b.solicita,
        adjuntos,
      });
      res.redirect(`/presentaciones/${pres._id}`);
    } catch (err) { next(err); }
  });

  // Detalle. RF-04/RF-05: contribuyente propietario o funcionario del área.
  router.get('/:id', requireAuth, async (req, res, next) => {
    try {
      const p = await dom.obtener(db, req.params.id);
      if (!p) return res.status(404).send(info('No encontrada', 'La presentación no existe.', req.session.user));
      const u = req.session.user;
      const esPropietario = u.rol === 'contribuyente' && p.contribuyenteId.toString() === u.id;
      const esFuncionarioArea = u.rol === 'funcionario' && p.areaId && u.areas.includes(p.areaId.toString());
      if (!esPropietario && !esFuncionarioArea) {
        return res.status(403).send(info('No autorizado', 'No puedes ver esta presentación.', u));
      }
      const exp = await expedientes.porPresentacion(db, p._id);
      const adjuntos = (p.adjuntos || []).map((a) => `<li>${esc(a.nombre)} <small>(${a.tamano} B)</small></li>`).join('') || '<li>Sin adjuntos</li>';

      let bloqueFuncionario = '';
      if (esFuncionarioArea) {
        bloqueFuncionario = exp
          ? `<p>Expediente asociado: <a href="/expedientes/${exp._id}">${esc(exp.codigo)}</a></p>`
          : `<form method="post" action="/expedientes" class="card">
               <input type="hidden" name="presentacionId" value="${p._id}">
               <label>Tipo de expediente</label>
               <input name="tipo" required placeholder="Ej. Licencia de obra menor">
               <p><button type="submit">Crear expediente</button></p>
             </form>`;
      }

      res.send(layout(`Presentación ${p.numeroRegistro}`, `
        <h1>Instancia general ${esc(p.numeroRegistro)}</h1>
        <div class="card">
          <p><b>Interesado:</b> ${esc(p.interesado.nombre)} — ${esc(p.interesado.direccionFiscal)}</p>
          ${p.representante ? `<p><b>Representante:</b> ${esc(p.representante)}</p>` : ''}
          <p><b>Fecha de entrada:</b> ${new Date(p.fechaEntrada).toLocaleString('es-ES')}</p>
          <p><b>Estado:</b> ${esc(p.estado)}</p>
        </div>
        <div class="card"><b>EXPONE</b><p>${esc(p.expone)}</p></div>
        <div class="card"><b>SOLICITA</b><p>${esc(p.solicita)}</p></div>
        <div class="card"><b>Adjuntos</b><ul>${adjuntos}</ul></div>
        ${bloqueFuncionario}
        <p><a href="${esPropietario ? '/presentaciones/mias' : '/funcionario'}">← Volver</a></p>`,
        u));
    } catch (err) { next(err); }
  });

  return router;
};
