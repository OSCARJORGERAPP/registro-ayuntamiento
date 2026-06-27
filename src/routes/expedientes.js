const express = require('express');
const { requireRole } = require('../middleware/auth');
const { layout, info, esc } = require('../views/render');
const expedientes = require('../domain/expedientes');
const actuaciones = require('../domain/actuaciones');
const presentaciones = require('../domain/presentaciones');

module.exports = function expedientesRoutes(db) {
  const router = express.Router();

  // RF-06: crear expediente a partir de una presentación (solo funcionario del área).
  router.post('/', requireRole('funcionario'), async (req, res, next) => {
    try {
      const { presentacionId, tipo } = req.body;
      if (!presentacionId || !tipo) {
        return res.status(400).send(info('Faltan datos', 'Indica el tipo de expediente.', req.session.user));
      }
      const pres = await presentaciones.obtener(db, presentacionId);
      if (!pres) return res.status(404).send(info('No encontrada', 'La presentación no existe.', req.session.user));
      if (!pres.areaId || !req.session.user.areas.includes(pres.areaId.toString())) {
        return res.status(403).send(info('No autorizado', 'La presentación no es de tu área.', req.session.user));
      }
      const existente = await expedientes.porPresentacion(db, presentacionId);
      if (existente) return res.redirect(`/expedientes/${existente._id}`);

      const exp = await expedientes.crearExpediente(db, {
        tipo,
        presentacionId,
        contribuyenteId: pres.contribuyenteId,
        areaId: pres.areaId,
      });
      res.redirect(`/expedientes/${exp._id}`);
    } catch (err) { next(err); }
  });

  // RF-08: consultar expediente con sus actuaciones.
  router.get('/:id', requireRole('funcionario'), async (req, res, next) => {
    try {
      const exp = await expedientes.obtener(db, req.params.id);
      if (!exp) return res.status(404).send(info('No encontrado', 'El expediente no existe.', req.session.user));
      if (!exp.areaId || !req.session.user.areas.includes(exp.areaId.toString())) {
        return res.status(403).send(info('No autorizado', 'El expediente no es de tu área.', req.session.user));
      }
      const lista = await actuaciones.listarPorExpediente(db, exp._id);
      const filas = lista.map((a) => `<div class="card"><small>${new Date(a.fecha).toLocaleString('es-ES')}</small><p>${esc(a.texto)}</p></div>`).join('')
        || '<p>Sin actuaciones todavía.</p>';

      res.send(layout(`Expediente ${exp.codigo}`, `
        <h1>Expediente ${esc(exp.codigo)}</h1>
        <div class="card">
          <p><b>Tipo:</b> ${esc(exp.tipo)}</p>
          <p><b>Fecha de creación:</b> ${new Date(exp.fechaCreacion).toLocaleString('es-ES')}</p>
          <p><b>Presentación de origen:</b> <a href="/presentaciones/${exp.presentacionId}">ver</a></p>
        </div>
        <h2>Actuaciones</h2>
        ${filas}
        <form method="post" action="/expedientes/${exp._id}/actuaciones" class="card">
          <label>Nueva actuación</label>
          <textarea name="texto" rows="3" required></textarea>
          <p><button type="submit">Registrar actuación</button></p>
        </form>
        <p><a href="/funcionario">← Volver</a></p>`, req.session.user));
    } catch (err) { next(err); }
  });

  // RF-07: registrar actuación (fecha + texto).
  router.post('/:id/actuaciones', requireRole('funcionario'), async (req, res, next) => {
    try {
      const exp = await expedientes.obtener(db, req.params.id);
      if (!exp) return res.status(404).send(info('No encontrado', 'El expediente no existe.', req.session.user));
      if (!exp.areaId || !req.session.user.areas.includes(exp.areaId.toString())) {
        return res.status(403).send(info('No autorizado', 'El expediente no es de tu área.', req.session.user));
      }
      const texto = String(req.body.texto || '').trim();
      if (!texto) return res.status(400).send(info('Falta texto', 'La actuación necesita texto.', req.session.user));
      await actuaciones.agregarActuacion(db, { expedienteId: exp._id, texto, funcionarioId: req.session.user.id });
      res.redirect(`/expedientes/${exp._id}`);
    } catch (err) { next(err); }
  });

  return router;
};
