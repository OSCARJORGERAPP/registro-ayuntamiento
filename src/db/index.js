const { MongoClient } = require('mongodb');
const config = require('../config');
const metrics = require('../metrics');

let client;
let db;

// Registra la duración real de cada comando MongoDB en las métricas.
function attachMongoMetrics(c) {
  c.on('commandSucceeded', (ev) => metrics.recordMongo(ev.commandName, ev.duration));
  c.on('commandFailed', (ev) => metrics.recordMongo(ev.commandName, ev.duration));
  return c;
}

async function connect() {
  if (db) return db;
  client = attachMongoMetrics(new MongoClient(config.mongo.uri, { monitorCommands: true }));
  await client.connect();
  db = client.db(config.mongo.db);
  return db;
}

async function close() {
  if (client) await client.close();
  client = undefined;
  db = undefined;
}

function getDb() {
  if (!db) throw new Error('DB no inicializada: llama a connect() primero');
  return db;
}

module.exports = { connect, close, getDb, attachMongoMetrics };
