const { test } = require('node:test');
const assert = require('node:assert');
const { hashToken } = require('../src/auth/magicLink');

// Test unitario puro (sin BD): el hash es estable y no expone el token crudo.
test('hashToken es determinista y oculta el valor crudo', () => {
  const raw = 'token-de-prueba';
  const h1 = hashToken(raw);
  const h2 = hashToken(raw);
  assert.strictEqual(h1, h2);
  assert.notStrictEqual(h1, raw);
  assert.match(h1, /^[a-f0-9]{64}$/);
});
