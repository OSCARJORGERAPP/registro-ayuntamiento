// Métricas en memoria, sin dependencias: latencias HTTP, operaciones MongoDB y proceso.
// Se exponen en GET /metrics (ver app.js). Pensado para un MVP; en producción se
// puede exportar a Prometheus/OpenTelemetry desde estos mismos puntos de registro.

const MAX_SAMPLES = 1000; // ventana deslizante por clave (acota memoria)

class Histograma {
  constructor() {
    this.samples = [];
    this.count = 0;
    this.sum = 0;
  }

  add(ms) {
    this.count += 1;
    this.sum += ms;
    this.samples.push(ms);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  percentil(p) {
    if (this.samples.length === 0) return 0;
    const ord = [...this.samples].sort((a, b) => a - b);
    const idx = Math.max(0, Math.min(ord.length - 1, Math.ceil((p / 100) * ord.length) - 1));
    return redondear(ord[idx]);
  }

  resumen() {
    return {
      count: this.count,
      avg: this.count ? redondear(this.sum / this.count) : 0,
      p50: this.percentil(50),
      p95: this.percentil(95),
      p99: this.percentil(99),
    };
  }
}

function redondear(n) {
  return Math.round(n * 100) / 100;
}

const http = new Map(); // label -> { hist, errores }
const mongo = new Map(); // commandName -> hist
let httpTotal = 0;
let httpErrores = 0;
const inicio = Date.now();

// Normaliza ids (ObjectId de 24 hex o numéricos) a ':id' para agrupar endpoints.
function etiquetaRuta(method, ruta) {
  const norm = String(ruta)
    .split('/')
    .map((seg) => (/^[a-f0-9]{24}$/i.test(seg) || /^\d+$/.test(seg) ? ':id' : seg))
    .join('/');
  return `${method} ${norm || '/'}`;
}

function recordHttp(method, ruta, ms, status) {
  httpTotal += 1;
  const label = etiquetaRuta(method, ruta);
  let e = http.get(label);
  if (!e) { e = { hist: new Histograma(), errores: 0 }; http.set(label, e); }
  e.hist.add(ms);
  if (status >= 500) { e.errores += 1; httpErrores += 1; }
}

function recordMongo(comando, ms) {
  let h = mongo.get(comando);
  if (!h) { h = new Histograma(); mongo.set(comando, h); }
  h.add(ms);
}

function snapshot() {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const rutas = {};
  for (const [label, e] of http) rutas[label] = { ...e.hist.resumen(), errores: e.errores };
  const ops = {};
  for (const [cmd, h] of mongo) ops[cmd] = h.resumen();
  return {
    uptime_s: Math.round((Date.now() - inicio) / 1000),
    http: {
      total: httpTotal,
      errores: httpErrores,
      tasa_error: httpTotal ? redondear(httpErrores / httpTotal) : 0,
      por_ruta: rutas,
    },
    mongo_ops: ops,
    proceso: {
      rss_mb: redondear(mem.rss / 1048576),
      heap_used_mb: redondear(mem.heapUsed / 1048576),
      cpu_user_s: redondear(cpu.user / 1e6),
    },
  };
}

function reset() {
  http.clear();
  mongo.clear();
  httpTotal = 0;
  httpErrores = 0;
}

module.exports = { Histograma, recordHttp, recordMongo, snapshot, reset, etiquetaRuta };
