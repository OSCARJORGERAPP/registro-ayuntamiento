// Integración de /metrics contra MongoDB: latencias por ruta, ops Mongo y tamaños.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { mongoDisponible, setup, teardown, limpiar, seedBase } = require('./helpers/integration');

let ctx = null;
let mongoDown = false;

before(async () => {
  if (!(await mongoDisponible())) { mongoDown = true; return; }
  ctx = await setup('metrics');
  await limpiar(ctx.db);
  await seedBase(ctx.db);
});

after(async () => { await teardown(ctx); });

function rf(name, fn) {
  test(name, async (t) => {
    if (mongoDown) { t.skip('MongoDB no disponible'); return; }
    await fn(t);
  });
}

rf('/metrics expone latencias por ruta, operaciones Mongo y tamaños de colección', async () => {
  // Genera algo de tráfico (la landing hace una consulta a Mongo).
  await fetch(`${ctx.base}/`);
  await fetch(`${ctx.base}/health`);
  await fetch(`${ctx.base}/area/URB`);

  const res = await fetch(`${ctx.base}/metrics`);
  assert.strictEqual(res.status, 200);
  const m = await res.json();

  // HTTP: hay tráfico registrado y la landing aparece agrupada.
  assert.ok(m.http.total >= 3);
  assert.ok(m.http.por_ruta['GET /'], 'debe registrar la landing');
  assert.ok(m.http.por_ruta['GET /'].p95 >= 0);

  // Mongo: se capturó al menos una operación de consulta (find).
  assert.ok(Object.keys(m.mongo_ops).length > 0, 'debe registrar operaciones Mongo');

  // Tamaños: la colección de áreas sembrada reporta documentos.
  assert.ok(m.datos, 'debe incluir tamaños de colecciones');
  assert.ok(m.datos.areas.docs >= 2);

  // Proceso.
  assert.ok(m.proceso.rss_mb > 0);
  assert.strictEqual(typeof m.uptime_s, 'number');
});
