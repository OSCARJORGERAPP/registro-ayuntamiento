const { test } = require('node:test');
const assert = require('node:assert');
const { Histograma, etiquetaRuta, recordHttp, snapshot, reset } = require('../src/metrics');

test('Histograma calcula percentiles', () => {
  const h = new Histograma();
  for (let i = 1; i <= 100; i += 1) h.add(i); // 1..100
  const r = h.resumen();
  assert.strictEqual(r.count, 100);
  assert.strictEqual(r.p50, 50);
  assert.strictEqual(r.p95, 95);
  assert.strictEqual(r.p99, 99);
  assert.ok(Math.abs(r.avg - 50.5) < 0.01);
});

test('Histograma vacío devuelve ceros', () => {
  const h = new Histograma();
  assert.deepStrictEqual(h.resumen(), { count: 0, avg: 0, p50: 0, p95: 0, p99: 0 });
});

test('etiquetaRuta normaliza ObjectId y numéricos a :id', () => {
  assert.strictEqual(etiquetaRuta('GET', '/'), 'GET /');
  assert.strictEqual(etiquetaRuta('GET', '/presentaciones/507f1f77bcf86cd799439011'), 'GET /presentaciones/:id');
  assert.strictEqual(etiquetaRuta('POST', '/expedientes/42/actuaciones'), 'POST /expedientes/:id/actuaciones');
});

test('recordHttp agrega por ruta y cuenta errores 5xx', () => {
  reset();
  recordHttp('GET', '/health', 5, 200);
  recordHttp('GET', '/health', 7, 200);
  recordHttp('GET', '/boom', 3, 500);
  const s = snapshot();
  assert.strictEqual(s.http.total, 3);
  assert.strictEqual(s.http.errores, 1);
  assert.strictEqual(s.http.por_ruta['GET /health'].count, 2);
  assert.strictEqual(s.http.por_ruta['GET /boom'].errores, 1);
  assert.ok(s.proceso.rss_mb > 0);
});
