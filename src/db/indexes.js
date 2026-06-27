// Índices declarados en PROMPT.md §6. Idempotente: se puede llamar en cada arranque.
async function ensureIndexes(db) {
  await db.collection('usuarios').createIndex({ email: 1 }, { unique: true });
  await db.collection('areas').createIndex({ codigo: 1 }, { unique: true });
  await db.collection('presentaciones').createIndex({ numeroRegistro: 1 }, { unique: true });
  await db.collection('presentaciones').createIndex({ contribuyenteId: 1 });
  await db.collection('presentaciones').createIndex({ areaId: 1 });
  await db.collection('expedientes').createIndex({ codigo: 1 }, { unique: true });
  await db.collection('expedientes').createIndex({ presentacionId: 1 });
  await db.collection('actuaciones').createIndex({ expedienteId: 1 });
  await db.collection('magic_tokens').createIndex({ tokenHash: 1 }, { unique: true });
  // TTL: MongoDB borra el token cuando expiraEn queda en el pasado.
  await db.collection('magic_tokens').createIndex({ expiraEn: 1 }, { expireAfterSeconds: 0 });
}

module.exports = { ensureIndexes };
