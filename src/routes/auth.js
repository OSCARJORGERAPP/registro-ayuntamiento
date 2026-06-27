const express = require('express');
const { issueToken, consumeToken } = require('../auth/magicLink');
const { sendMagicLink } = require('../auth/mailer');
const { info } = require('../views/render');
const config = require('../config');

module.exports = function authRoutes(db) {
  const router = express.Router();

  // RF-01: solicitar enlace de acceso.
  router.post('/magic-link', async (req, res, next) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      if (!email) return res.status(400).send(info('Falta el email', 'Introduce un email válido.', null));
      const raw = await issueToken(db, email);
      const url = `${config.appUrl}/auth/verify?token=${raw}`;
      await sendMagicLink(email, url);
      res.send(info('Revisa tu email',
        `Hemos enviado un enlace de acceso a <b>${email}</b>. Caduca en ${config.magicLinkTtlMin} minutos.`
        + (config.env !== 'production' ? '<br><small>(En desarrollo, el enlace también aparece en la consola del servidor.)</small>' : ''),
        null));
    } catch (err) { next(err); }
  });

  // RF-01: verificar el token y crear sesión.
  router.get('/verify', async (req, res, next) => {
    try {
      const result = await consumeToken(db, req.query.token);
      if (!result.ok) {
        return res.status(400).send(info('Enlace no válido', `El enlace está <b>${result.reason}</b>. Solicita uno nuevo.`, null));
      }
      // Auto-registro como contribuyente si el email no existía.
      let user = await db.collection('usuarios').findOne({ email: result.email });
      if (!user) {
        const doc = { email: result.email, rol: 'contribuyente', nombre: result.email, areas: [], creado: new Date() };
        const r = await db.collection('usuarios').insertOne(doc);
        user = { ...doc, _id: r.insertedId };
      }
      req.session.user = {
        id: user._id.toString(),
        email: user.email,
        rol: user.rol,
        nombre: user.nombre,
        areas: (user.areas || []).map((a) => a.toString()),
      };
      res.redirect(user.rol === 'funcionario' ? '/funcionario' : '/presentaciones/mias');
    } catch (err) { next(err); }
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
  });

  return router;
};
