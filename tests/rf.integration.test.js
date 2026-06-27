// Tests de integración por requisito funcional (RF-01..RF-10) contra MongoDB.
// Aísla en una BD de test y usa una carpeta temporal para adjuntos.
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.UPLOADS_DIR = path.join(os.tmpdir(), 'registro-test-uploads');

const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const { mongoDisponible, setup, teardown, limpiar, seedBase, login } = require('./helpers/integration');
const { issueToken, hashToken } = require('../src/auth/magicLink');
const presentaciones = require('../src/domain/presentaciones');
const expedientes = require('../src/domain/expedientes');
const actuaciones = require('../src/domain/actuaciones');

let ctx = null;
let ids = null;
let mongoDown = false;

before(async () => {
  if (!(await mongoDisponible())) { mongoDown = true; return; }
  ctx = await setup('rf');
});

after(async () => {
  await teardown(ctx);
  fs.rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  if (mongoDown) return;
  await limpiar(ctx.db);
  ids = await seedBase(ctx.db);
});

// Registra un test que se salta si no hay MongoDB accesible.
function rf(name, fn) {
  test(name, async (t) => {
    if (mongoDown) { t.skip('MongoDB no disponible'); return; }
    await fn(t);
  });
}

// --- helpers HTTP (con redirect manual para inspeccionar 302) ---
function post(p, cookie, body) {
  return fetch(ctx.base + p, {
    method: 'POST',
    headers: { cookie: cookie || '', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body || {}).toString(),
    redirect: 'manual',
  });
}
function get(p, cookie, accept) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (accept) headers.accept = accept;
  return fetch(ctx.base + p, { headers, redirect: 'manual' });
}
function nuevaPresentacion(contribuyenteId, areaId, extra = {}) {
  return presentaciones.crearPresentacion(ctx.db, {
    contribuyenteId, areaId,
    interesado: { nombre: 'X', direccionFiscal: 'Dir' },
    representante: null,
    expone: extra.expone || 'expone',
    solicita: extra.solicita || 'solicita',
    adjuntos: [],
  });
}
function nuevoExpediente(areaId, contribuyenteId) {
  return nuevaPresentacion(contribuyenteId, areaId).then((p) => expedientes.crearExpediente(ctx.db, {
    tipo: 'T', presentacionId: p._id, contribuyenteId, areaId,
  }));
}

// ===================== RF-01 — Magic link =====================
rf('RF-01: solicitar enlace crea un token de un solo uso', async () => {
  const res = await post('/auth/magic-link', null, { email: 'nuevo@ej.com' });
  assert.strictEqual(res.status, 200);
  const tokens = await ctx.db.collection('magic_tokens').find({ email: 'nuevo@ej.com' }).toArray();
  assert.strictEqual(tokens.length, 1);
  assert.strictEqual(tokens[0].usado, false);
});

rf('RF-01: verificar un token válido crea sesión y lo marca usado', async () => {
  const raw = await issueToken(ctx.db, 'ana@ej.com');
  const res = await get(`/auth/verify?token=${raw}`);
  assert.strictEqual(res.status, 302);
  assert.ok(res.headers.get('set-cookie'), 'debe emitir cookie de sesión');
  const tok = await ctx.db.collection('magic_tokens').findOne({ tokenHash: hashToken(raw) });
  assert.strictEqual(tok.usado, true);
});

rf('RF-01: un token ya usado se rechaza (400)', async () => {
  const raw = await issueToken(ctx.db, 'ana@ej.com');
  await get(`/auth/verify?token=${raw}`);
  const res = await get(`/auth/verify?token=${raw}`);
  assert.strictEqual(res.status, 400);
});

rf('RF-01: un token caducado se rechaza (400)', async () => {
  const raw = 'caducado-raw';
  await ctx.db.collection('magic_tokens').insertOne({
    email: 'ana@ej.com', tokenHash: hashToken(raw),
    expiraEn: new Date(Date.now() - 1000), usado: false, creado: new Date(),
  });
  const res = await get(`/auth/verify?token=${raw}`);
  assert.strictEqual(res.status, 400);
});

rf('RF-01: un token inexistente se rechaza (400)', async () => {
  const res = await get('/auth/verify?token=noexiste');
  assert.strictEqual(res.status, 400);
});

// ===================== RF-02 — Roles y autorización =====================
rf('RF-02: sin sesión, /funcionario responde 401', async () => {
  const res = await get('/funcionario', null, 'application/json');
  assert.strictEqual(res.status, 401);
});

rf('RF-02: un contribuyente no accede a /funcionario (403)', async () => {
  const cookie = await login(ctx, 'ana@ej.com');
  const res = await get('/funcionario', cookie, 'application/json');
  assert.strictEqual(res.status, 403);
});

rf('RF-02: un funcionario sí accede a /funcionario (200)', async () => {
  const cookie = await login(ctx, 'paco@ayto.com');
  const res = await get('/funcionario', cookie);
  assert.strictEqual(res.status, 200);
});

// ===================== RF-03 — Presentar instancia general =====================
rf('RF-03: se registra con nº de entrada y queda asociada al contribuyente', async () => {
  const cookie = await login(ctx, 'ana@ej.com');
  const res = await post('/presentaciones', cookie, {
    areaId: ids.urbId.toString(),
    interesadoNombre: 'Ana García',
    interesadoDireccion: 'C/ Mayor 1',
    expone: 'expongo',
    solicita: 'solicito licencia',
  });
  assert.strictEqual(res.status, 302);
  const lista = await ctx.db.collection('presentaciones').find({}).toArray();
  assert.strictEqual(lista.length, 1);
  const p = lista[0];
  assert.match(p.numeroRegistro, /^\d{4}\/\d{5}$/);
  assert.strictEqual(p.estado, 'registrada');
  assert.strictEqual(p.contribuyenteId.toString(), ids.anaId.toString());
  assert.strictEqual(p.interesado.direccionFiscal, 'C/ Mayor 1');
});

rf('RF-03: faltan campos obligatorios → 400', async () => {
  const cookie = await login(ctx, 'ana@ej.com');
  const res = await post('/presentaciones', cookie, { interesadoNombre: 'Ana' });
  assert.strictEqual(res.status, 400);
});

rf('RF-03: admite archivos adjuntos', async () => {
  const cookie = await login(ctx, 'ana@ej.com');
  const form = new FormData();
  form.append('areaId', ids.urbId.toString());
  form.append('interesadoNombre', 'Ana');
  form.append('interesadoDireccion', 'C/ Mayor 1');
  form.append('expone', 'e');
  form.append('solicita', 's');
  form.append('adjuntos', new Blob(['hola'], { type: 'text/plain' }), 'doc.txt');
  const res = await fetch(ctx.base + '/presentaciones', { method: 'POST', headers: { cookie }, body: form, redirect: 'manual' });
  assert.strictEqual(res.status, 302);
  const p = await ctx.db.collection('presentaciones').findOne({});
  assert.strictEqual(p.adjuntos.length, 1);
  assert.strictEqual(p.adjuntos[0].nombre, 'doc.txt');
  assert.strictEqual(p.adjuntos[0].tamano, 4);
});

// ===================== RF-04 — Consulta del contribuyente =====================
rf('RF-04: el contribuyente ve solo sus presentaciones', async () => {
  await nuevaPresentacion(ids.anaId, ids.urbId, { solicita: 'COSA-DE-ANA' });
  await nuevaPresentacion(ids.luisId, ids.urbId, { solicita: 'COSA-DE-LUIS' });
  const cookie = await login(ctx, 'ana@ej.com');
  const html = await (await get('/presentaciones/mias', cookie)).text();
  assert.ok(html.includes('COSA-DE-ANA'));
  assert.ok(!html.includes('COSA-DE-LUIS'));
});

rf('RF-04: no puede abrir la presentación de otro contribuyente (403)', async () => {
  const pLuis = await nuevaPresentacion(ids.luisId, ids.urbId);
  const cookie = await login(ctx, 'ana@ej.com');
  const res = await get(`/presentaciones/${pLuis._id}`, cookie);
  assert.strictEqual(res.status, 403);
});

// ===================== RF-05 — Vista del funcionario =====================
rf('RF-05: el funcionario ve las presentaciones de su área y no las de otras', async () => {
  await nuevaPresentacion(ids.anaId, ids.urbId, { solicita: 'EN-URBANISMO' });
  await nuevaPresentacion(ids.anaId, ids.hacId, { solicita: 'EN-HACIENDA' });
  const cookie = await login(ctx, 'paco@ayto.com');
  const html = await (await get('/funcionario', cookie)).text();
  assert.ok(html.includes('EN-URBANISMO'));
  assert.ok(!html.includes('EN-HACIENDA'));
});

rf('RF-05: puede abrir una presentación de su área (200)', async () => {
  const p = await nuevaPresentacion(ids.anaId, ids.urbId);
  const cookie = await login(ctx, 'paco@ayto.com');
  assert.strictEqual((await get(`/presentaciones/${p._id}`, cookie)).status, 200);
});

rf('RF-05: no puede abrir una presentación de otra área (403)', async () => {
  const p = await nuevaPresentacion(ids.anaId, ids.hacId);
  const cookie = await login(ctx, 'paco@ayto.com');
  assert.strictEqual((await get(`/presentaciones/${p._id}`, cookie)).status, 403);
});

// ===================== RF-06 — Crear expediente =====================
rf('RF-06: el funcionario crea un expediente asociado a la presentación', async () => {
  const p = await nuevaPresentacion(ids.anaId, ids.urbId);
  const cookie = await login(ctx, 'paco@ayto.com');
  const res = await post('/expedientes', cookie, { presentacionId: p._id.toString(), tipo: 'Licencia de obra' });
  assert.strictEqual(res.status, 302);
  const exp = await ctx.db.collection('expedientes').findOne({ presentacionId: p._id });
  assert.ok(exp);
  assert.match(exp.codigo, /^EXP-\d{4}-\d{4}$/);
  assert.strictEqual(exp.tipo, 'Licencia de obra');
  assert.strictEqual(exp.areaId.toString(), ids.urbId.toString());
  assert.strictEqual(exp.contribuyenteId.toString(), ids.anaId.toString());
});

rf('RF-06: no se crea por duplicado para la misma presentación', async () => {
  const p = await nuevaPresentacion(ids.anaId, ids.urbId);
  const cookie = await login(ctx, 'paco@ayto.com');
  await post('/expedientes', cookie, { presentacionId: p._id.toString(), tipo: 'A' });
  await post('/expedientes', cookie, { presentacionId: p._id.toString(), tipo: 'B' });
  assert.strictEqual(await ctx.db.collection('expedientes').countDocuments({ presentacionId: p._id }), 1);
});

rf('RF-06: un funcionario de otra área no puede crearlo (403)', async () => {
  const p = await nuevaPresentacion(ids.anaId, ids.urbId);
  const cookie = await login(ctx, 'marta@ayto.com');
  const res = await post('/expedientes', cookie, { presentacionId: p._id.toString(), tipo: 'X' });
  assert.strictEqual(res.status, 403);
});

rf('RF-06: falta el tipo de expediente → 400', async () => {
  const p = await nuevaPresentacion(ids.anaId, ids.urbId);
  const cookie = await login(ctx, 'paco@ayto.com');
  const res = await post('/expedientes', cookie, { presentacionId: p._id.toString() });
  assert.strictEqual(res.status, 400);
});

// ===================== RF-07 — Actuaciones =====================
rf('RF-07: se registra una actuación con fecha y texto', async () => {
  const exp = await nuevoExpediente(ids.urbId, ids.anaId);
  const cookie = await login(ctx, 'paco@ayto.com');
  const res = await post(`/expedientes/${exp._id}/actuaciones`, cookie, { texto: 'Informe favorable' });
  assert.strictEqual(res.status, 302);
  const acts = await actuaciones.listarPorExpediente(ctx.db, exp._id);
  assert.strictEqual(acts.length, 1);
  assert.strictEqual(acts[0].texto, 'Informe favorable');
  assert.ok(acts[0].fecha instanceof Date);
  assert.strictEqual(acts[0].funcionarioId.toString(), ids.pacoId.toString());
});

rf('RF-07: las actuaciones se listan en orden cronológico', async () => {
  const exp = await nuevoExpediente(ids.urbId, ids.anaId);
  const cookie = await login(ctx, 'paco@ayto.com');
  await post(`/expedientes/${exp._id}/actuaciones`, cookie, { texto: 'PRIMERA' });
  await post(`/expedientes/${exp._id}/actuaciones`, cookie, { texto: 'SEGUNDA' });
  const acts = await actuaciones.listarPorExpediente(ctx.db, exp._id);
  assert.deepStrictEqual(acts.map((a) => a.texto), ['PRIMERA', 'SEGUNDA']);
});

rf('RF-07: texto vacío → 400', async () => {
  const exp = await nuevoExpediente(ids.urbId, ids.anaId);
  const cookie = await login(ctx, 'paco@ayto.com');
  const res = await post(`/expedientes/${exp._id}/actuaciones`, cookie, { texto: '   ' });
  assert.strictEqual(res.status, 400);
});

// ===================== RF-08 — Consulta de expediente =====================
rf('RF-08: la vista del expediente muestra código y sus actuaciones', async () => {
  const exp = await nuevoExpediente(ids.urbId, ids.anaId);
  await actuaciones.agregarActuacion(ctx.db, { expedienteId: exp._id, texto: 'ACT-VISIBLE', funcionarioId: ids.pacoId });
  const cookie = await login(ctx, 'paco@ayto.com');
  const html = await (await get(`/expedientes/${exp._id}`, cookie)).text();
  assert.ok(html.includes(exp.codigo));
  assert.ok(html.includes('ACT-VISIBLE'));
});

rf('RF-08: un funcionario de otra área no ve el expediente (403)', async () => {
  const exp = await nuevoExpediente(ids.urbId, ids.anaId);
  const cookie = await login(ctx, 'marta@ayto.com');
  assert.strictEqual((await get(`/expedientes/${exp._id}`, cookie)).status, 403);
});

// ===================== RF-09 — Multi-área =====================
rf('RF-09: un funcionario solo opera las áreas asignadas', async () => {
  const expUrb = await nuevoExpediente(ids.urbId, ids.anaId);
  const expHac = await nuevoExpediente(ids.hacId, ids.anaId);
  const cookie = await login(ctx, 'paco@ayto.com');
  assert.strictEqual((await get(`/expedientes/${expUrb._id}`, cookie)).status, 200);
  assert.strictEqual((await get(`/expedientes/${expHac._id}`, cookie)).status, 403);
});

rf('RF-09: el código de área es único', async () => {
  await assert.rejects(
    ctx.db.collection('areas').insertOne({ codigo: 'URB', nombre: 'Dup', activo: true }),
    /duplicate key/,
  );
});

// ===================== RF-10 — Home personalizable por área =====================
rf('RF-10: cada área muestra su home personalizada (título y color)', async () => {
  const htmlUrb = await (await get('/area/URB')).text();
  const htmlHac = await (await get('/area/HAC')).text();
  assert.ok(htmlUrb.includes('Atención de Urbanismo'));
  assert.ok(htmlUrb.includes('#4a90e2'));
  assert.ok(htmlHac.includes('Oficina de Hacienda'));
  assert.ok(htmlHac.includes('#50c878'));
  assert.notStrictEqual(htmlUrb, htmlHac);
});

rf('RF-10: la home del área lista los funcionarios que la operan', async () => {
  const html = await (await get('/area/URB')).text();
  assert.ok(html.includes('Paco'));   // funcionario de URB
  assert.ok(!html.includes('Marta')); // funcionaria de HAC
});

rf('RF-10: un área inexistente → 404', async () => {
  assert.strictEqual((await get('/area/NOPE')).status, 404);
});
