const crypto = require('crypto');
const config = require('../config');

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Emite un token de un solo uso. Guarda solo el HASH; el valor crudo viaja en el enlace.
async function issueToken(db, email) {
  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(raw);
  const expiraEn = new Date(Date.now() + config.magicLinkTtlMin * 60 * 1000);
  await db.collection('magic_tokens').insertOne({
    email, tokenHash, expiraEn, usado: false, creado: new Date(),
  });
  return raw;
}

// Valida y consume el token. Devuelve { ok, email } o { ok:false, reason }.
async function consumeToken(db, raw) {
  if (!raw) return { ok: false, reason: 'invalido' };
  const tokenHash = hashToken(raw);
  const doc = await db.collection('magic_tokens').findOne({ tokenHash });
  if (!doc) return { ok: false, reason: 'invalido' };
  if (doc.usado) return { ok: false, reason: 'usado' };
  if (doc.expiraEn < new Date()) return { ok: false, reason: 'caducado' };
  await db.collection('magic_tokens').updateOne({ _id: doc._id }, { $set: { usado: true } });
  return { ok: true, email: doc.email };
}

module.exports = { issueToken, consumeToken, hashToken };
