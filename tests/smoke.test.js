const { test } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

// Smoke test sin base de datos: la app arranca y /health responde.
test('GET /health responde ok sin requerir MongoDB', async () => {
  const app = createApp(null);
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://localhost:${port}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
  } finally {
    server.close();
  }
});

// Endpoints protegidos rechazan a los no autenticados (RF-02).
test('GET /funcionario sin sesión devuelve 401', async () => {
  const app = createApp(null);
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://localhost:${port}/funcionario`, { headers: { accept: 'application/json' } });
    assert.strictEqual(res.status, 401);
  } finally {
    server.close();
  }
});
