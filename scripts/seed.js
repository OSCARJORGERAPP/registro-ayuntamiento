// Aprovisiona datos de ejemplo (dev/test/demo). Siempre limpia y re-siembra.
const { connect, close } = require('../src/db');
const { ensureIndexes } = require('../src/db/indexes');
const presentaciones = require('../src/domain/presentaciones');
const expedientes = require('../src/domain/expedientes');
const actuaciones = require('../src/domain/actuaciones');

const COLECCIONES = ['areas', 'usuarios', 'magic_tokens', 'presentaciones', 'expedientes', 'actuaciones'];

async function main() {
  const db = await connect();

  for (const c of COLECCIONES) await db.collection(c).deleteMany({});
  await ensureIndexes(db);

  const areas = await db.collection('areas').insertMany([
    { codigo: 'URB', nombre: 'Urbanismo', config_home: { titulo: 'Urbanismo', color: '#4a90e2' }, activo: true },
    { codigo: 'HAC', nombre: 'Hacienda', config_home: { titulo: 'Hacienda', color: '#50c878' }, activo: true },
  ]);
  const urbId = areas.insertedIds[0];
  const hacId = areas.insertedIds[1];

  const usuarios = await db.collection('usuarios').insertMany([
    { email: 'ana.contribuyente@ejemplo.com', rol: 'contribuyente', nombre: 'Ana García', areas: [], creado: new Date() },
    { email: 'luis.contribuyente@ejemplo.com', rol: 'contribuyente', nombre: 'Luis Pérez', areas: [], creado: new Date() },
    { email: 'paco.funcionario@ayto.example', rol: 'funcionario', nombre: 'Paco (Urbanismo)', areas: [urbId], creado: new Date() },
    { email: 'marta.funcionaria@ayto.example', rol: 'funcionario', nombre: 'Marta (Hacienda)', areas: [hacId], creado: new Date() },
  ]);
  const anaId = usuarios.insertedIds[0];
  const pacoId = usuarios.insertedIds[2];

  const pres = await presentaciones.crearPresentacion(db, {
    contribuyenteId: anaId,
    areaId: urbId,
    interesado: { nombre: 'Ana García', direccionFiscal: 'C/ Mayor 1, 28000 Madrid' },
    representante: null,
    expone: 'Que soy propietaria de la vivienda sita en C/ Mayor 1.',
    solicita: 'Licencia de obra menor para reforma de baño.',
    adjuntos: [],
  });

  const exp = await expedientes.crearExpediente(db, {
    tipo: 'Licencia de obra menor',
    presentacionId: pres._id,
    contribuyenteId: anaId,
    areaId: urbId,
  });
  await actuaciones.agregarActuacion(db, {
    expedienteId: exp._id,
    texto: 'Expediente iniciado. Pendiente de informe técnico.',
    funcionarioId: pacoId,
  });

  console.log('✅ Seed completado:');
  console.log('   Áreas:        Urbanismo (URB), Hacienda (HAC)');
  console.log('   Contribuyentes: ana.contribuyente@ejemplo.com, luis.contribuyente@ejemplo.com');
  console.log('   Funcionarios:   paco.funcionario@ayto.example (URB), marta.funcionaria@ayto.example (HAC)');
  console.log(`   Ejemplo:        presentación ${pres.numeroRegistro} → expediente ${exp.codigo}`);
  console.log('\n   Inicia sesión con cualquiera de esos emails (el enlace sale en la consola / MailHog).');

  await close();
}

main().catch((err) => { console.error(err); process.exit(1); });
