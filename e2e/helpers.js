// Utilidades para los e2e: conexión a la BD de e2e y login por magic link.
const { MongoClient } = require('mongodb');
const { issueToken } = require('../src/auth/magicLink');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'registro_e2e';

async function openDb() {
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  return { client, db: client.db(DB_NAME) };
}

// Emite un token real y devuelve la ruta /auth/verify para autenticarse en el navegador.
async function magicVerifyPath(db, email) {
  const raw = await issueToken(db, email);
  return `/auth/verify?token=${raw}`;
}

module.exports = { openDb, magicVerifyPath, URI, DB_NAME };
