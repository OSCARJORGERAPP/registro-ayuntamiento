// Sonda de carga sin dependencias: dispara peticiones concurrentes y reporta
// throughput y latencias p50/p95/p99. Sirve para medir concurrencia y el punto
// de degradación (RF/PROMPT.md §5/§8). El servidor debe estar arrancado.
//
//   node scripts/loadtest.js [url] [concurrencia] [total]
//   LOAD_URL=... LOAD_CONC=100 LOAD_TOTAL=5000 node scripts/loadtest.js

const URL = process.argv[2] || process.env.LOAD_URL || 'http://localhost:3000/health';
const CONC = parseInt(process.env.LOAD_CONC || process.argv[3] || '50', 10);
const TOTAL = parseInt(process.env.LOAD_TOTAL || process.argv[4] || '1000', 10);

async function main() {
  const lat = [];
  let errores = 0;
  let enviadas = 0;
  const t0 = Date.now();

  async function worker() {
    // El par "check + incremento" es síncrono (sin await en medio): no sobrepasa TOTAL.
    while (enviadas < TOTAL) {
      enviadas += 1;
      const s = process.hrtime.bigint();
      try {
        const r = await fetch(URL);
        await r.arrayBuffer();
        if (r.status >= 500) errores += 1;
      } catch {
        errores += 1;
      }
      lat.push(Number(process.hrtime.bigint() - s) / 1e6);
    }
  }

  await Promise.all(Array.from({ length: CONC }, worker));

  const dur = (Date.now() - t0) / 1000;
  lat.sort((a, b) => a - b);
  const pct = (p) => lat[Math.max(0, Math.min(lat.length - 1, Math.ceil((p / 100) * lat.length) - 1))] || 0;

  console.log(`URL:          ${URL}`);
  console.log(`peticiones:   ${lat.length}  concurrencia: ${CONC}  errores: ${errores}`);
  console.log(`throughput:   ${Math.round(lat.length / dur)} req/s  (${dur.toFixed(2)}s)`);
  console.log(`latencia ms:  p50=${pct(50).toFixed(1)}  p95=${pct(95).toFixed(1)}  p99=${pct(99).toFixed(1)}  max=${(lat[lat.length - 1] || 0).toFixed(1)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
