// Helpers para tests de integración contra MongoDB (base de datos de test aislada).
const { MongoClient, ObjectId } = require('mongodb');
const { ensureIndexes } = require('../../src/db/indexes');
const { attachMongoMetrics } = require('../../src/db');
const { createApp } = require('../../src/app');
const { issueToken } = require('../../src/auth/magicLink');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = `${process.env.MONGODB_DB || 'registro_municipal'}_test`;
const COLECCIONES = ['areas', 'usuarios', 'magic_tokens', 'presentaciones', 'expedientes', 'actuaciones'];

// ¿Hay un MongoDB accesible? Si no, los tests de integración se saltan.
async function mongoDisponible() {
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 1500 });
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    return true;
  } catch {
    return false;
  } finally {
    await client.close().catch(() => {});
  }
}

// `sufijo` aísla la BD por archivo de test (los ficheros corren en paralelo y cada
// uno limpia/siembra su BD; sin aislar se pisarían entre sí).
async function setup(sufijo) {
  const client = attachMongoMetrics(new MongoClient(URI, { serverSelectionTimeoutMS: 3000, monitorCommands: true }));
  await client.connect();
  const db = client.db(sufijo ? `${DB_NAME}_${sufijo}` : DB_NAME);
  await ensureIndexes(db);
  const server = createApp(db).listen(0);
  const base = `http://localhost:${server.address().port}`;
  return { client, db, server, base };
}

async function teardown(ctx) {
  if (!ctx) return;
  if (ctx.server) ctx.server.close();
  if (ctx.client) await ctx.client.close().catch(() => {});
}

async function limpiar(db) {
  for (const c of COLECCIONES) await db.collection(c).deleteMany({});
}

// Datos base: 2 áreas, 2 contribuyentes, 2 funcionarios (uno por área).
async function seedBase(db) {
  const areas = await db.collection('areas').insertMany([
    { codigo: 'URB', nombre: 'Urbanismo', config_home: { titulo: 'Atención de Urbanismo', color: '#4a90e2' }, activo: true },
    { codigo: 'HAC', nombre: 'Hacienda', config_home: { titulo: 'Oficina de Hacienda', color: '#50c878' }, activo: true },
  ]);
  const urbId = areas.insertedIds[0];
  const hacId = areas.insertedIds[1];
  const usuarios = await db.collection('usuarios').insertMany([
    { email: 'ana@ej.com', rol: 'contribuyente', nombre: 'Ana', areas: [], creado: new Date() },
    { email: 'luis@ej.com', rol: 'contribuyente', nombre: 'Luis', areas: [], creado: new Date() },
    { email: 'paco@ayto.com', rol: 'funcionario', nombre: 'Paco', areas: [urbId], creado: new Date() },
    { email: 'marta@ayto.com', rol: 'funcionario', nombre: 'Marta', areas: [hacId], creado: new Date() },
  ]);
  return {
    urbId, hacId,
    anaId: usuarios.insertedIds[0],
    luisId: usuarios.insertedIds[1],
    pacoId: usuarios.insertedIds[2],
    martaId: usuarios.insertedIds[3],
  };
}

// Inicia sesión simulando que se abre el enlace mágico; devuelve la cookie de sesión.
async function login(ctx, email) {
  const raw = await issueToken(ctx.db, email);
  const res = await fetch(`${ctx.base}/auth/verify?token=${raw}`, { redirect: 'manual' });
  const sc = res.headers.get('set-cookie');
  return sc ? sc.split(';')[0] : null;
}

module.exports = { mongoDisponible, setup, teardown, limpiar, seedBase, login, COLECCIONES, ObjectId };
