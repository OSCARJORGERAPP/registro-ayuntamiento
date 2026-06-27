const config = require('./config');
const { connect } = require('./db');
const { ensureIndexes } = require('./db/indexes');
const { createApp } = require('./app');

async function main() {
  const db = await connect();
  await ensureIndexes(db);
  const app = createApp(db);
  app.listen(config.port, () => {
    console.log(`Registro Municipal escuchando en ${config.appUrl} (puerto ${config.port})`);
  });
}

main().catch((err) => {
  console.error('No se pudo arrancar el servidor:', err.message);
  process.exit(1);
});
