// Prepara una BD de e2e limpia y sembrada (áreas + usuarios) antes de los tests.
const { MongoClient } = require('mongodb');
const { ensureIndexes } = require('../src/db/indexes');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'registro_e2e';
const COLECCIONES = ['areas', 'usuarios', 'magic_tokens', 'presentaciones', 'expedientes', 'actuaciones'];

module.exports = async () => {
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(DB_NAME);

  for (const c of COLECCIONES) await db.collection(c).deleteMany({});
  await ensureIndexes(db);

  await db.collection('areas').insertMany([
    { codigo: 'URB', nombre: 'Urbanismo', config_home: { titulo: 'Atención de Urbanismo', color: '#4a90e2' }, activo: true },
    { codigo: 'HAC', nombre: 'Hacienda', config_home: { titulo: 'Oficina de Hacienda', color: '#50c878' }, activo: true },
  ]);
  const urb = await db.collection('areas').findOne({ codigo: 'URB' });
  await db.collection('usuarios').insertMany([
    { email: 'ana@ej.com', rol: 'contribuyente', nombre: 'Ana', areas: [], creado: new Date() },
    { email: 'paco@ayto.com', rol: 'funcionario', nombre: 'Paco', areas: [urb._id], creado: new Date() },
  ]);

  await client.close();
  console.log(`[e2e] BD '${DB_NAME}' preparada (URI ${URI}).`);
};
