# AGENTS.md — Guía operativa de Registro Municipal

> Especificación del producto: ver `PROMPT.md`. Este archivo es el **cómo**.
> Stack: Node.js + Express + MongoDB (driver nativo) + magic link + Playwright.

## 🚀 Instalación (paso a paso)
```bash
# 1. Dependencias  → genera package-lock.json (en CI usar `npm ci`)
npm install
# 2. Variables de entorno
cp .env.example .env   # configurar MONGODB_URI, APP_URL, MAIL_*, SESSION_SECRET...
```

## 🗄️ Servicios locales (MongoDB + email)
```bash
# MongoDB (recomendado vía Docker para dev)
docker run -d --name registro-mongo -p 27017:27017 mongo:7
mongosh "mongodb://localhost:27017"   # verificar conexión

# Email de desarrollo: MailHog (captura los magic links)
docker run -d --name registro-mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog
# Bandeja: http://localhost:8025  (SMTP en :1025)
```
Variables clave: `MONGODB_URI`, `MAIL_HOST`/`MAIL_PORT`, `APP_URL`. Índices a crear:
`usuarios.email` (único), `areas.codigo` (único), `presentaciones.numeroRegistro`
(único), `expedientes.codigo` (único), TTL en `magic_tokens.expiraEn`.

Datos de ejemplo (seed) para dev/test/demo:
```bash
npm run seed          # áreas, usuarios, presentaciones y expedientes de ejemplo + índices
npm run seed:reset    # limpia colecciones y re-siembra
```
El seed usa el **driver nativo** (sin ODM) y refleja el modelo de `PROMPT.md §6`.

## ▶️ Arranque del sistema
```bash
npm run dev     # desarrollo (con recarga)
npm run build && npm start   # producción
```
URLs: app en `http://localhost:$PORT`, landing en `/`, API en `/api`.

## ✅ Tests
```bash
npm test              # suite completa (unit + integración, requiere MongoDB)
npm run test:watch    # desarrollo
npm run test:cov      # cobertura
npx playwright install chromium   # solo la primera vez (descarga el navegador)
npm run test:e2e      # Playwright e2e (BD aislada 'registro_e2e', arranca el server solo)
```
Política: cada RF de `PROMPT.md` tiene ≥1 test. PR sin tests no se mergea.
Tests e2e clave: magic link login, presentar instancia, crear expediente, actuación.

## 🧱 Estructura del proyecto (prevista)
```
src/
  server.js          # arranque Express
  db/                # conexión MongoDB nativa + índices
  auth/              # magic link: emisión y validación de tokens, sesión
  routes/            # /auth, /presentaciones, /expedientes, /areas
  domain/            # lógica: presentaciones, expedientes, actuaciones
  views/             # vistas server-rendered + home por área
  uploads/           # adjuntos en dev (no commitear)
scripts/seed.js      # datos de ejemplo
tests/               # unit + integración
e2e/                 # Playwright
```

## 🧭 Convenciones
- Acceso a datos: **driver nativo de MongoDB**, sin ODM salvo justificación.
- Autorización en **servidor** por rol/área (no confiar en la UI) — ver RF-02/RF-09.
- Validación de entrada en servidor; campos obligatorios de la instancia (RF-03).
- Naming en español del dominio (presentacion, expediente, actuacion).
- Commits convencionales; manejo de errores centralizado con códigos HTTP claros.

## 📊 Métricas (cómo recolectarlas)
Implementadas en `src/metrics.js`, sin dependencias externas.

```bash
# Snapshot de observabilidad (latencias por ruta, ops Mongo, tamaños, proceso)
curl http://localhost:3000/metrics | jq

# Carga/concurrencia y punto de degradación (servidor arrancado)
npm run loadtest http://localhost:3000/ 50 500     # url concurrencia total
LOAD_CONC=100 LOAD_TOTAL=5000 npm run loadtest      # vía variables de entorno
```

`GET /metrics` devuelve JSON con:
- `http.por_ruta`: p50/p95/p99 + count + errores por endpoint (ids → `:id`); `total`, `tasa_error`.
- `mongo_ops`: tiempos reales por operación (command monitoring del driver).
- `datos`: bytes por documento y almacenamiento por colección (`collStats`).
- `proceso`: RSS, heap, CPU, `uptime_s`.

Umbrales objetivo y baselines medidos en `PROMPT.md §5/§8`.

## 🌐 Deployment (imagen Docker)
CI **construye** la imagen (job `docker-image`) para validar el Dockerfile; el push
está deshabilitado (la instancia no tiene Container Registry). El despliegue es
**fuera de banda**: build local + `docker compose`. Guía completa: `DEPLOYMENT.md`.

```bash
# Build local de la imagen de producción
docker build -t registro-ayuntamiento:local .

# Ejecutar el stack (app + mongo); índices Mongo automáticos al arrancar
SESSION_SECRET=dev docker compose up -d
docker compose --profile dev up -d        # incluye MailHog (demo)
docker compose exec app npm run seed      # datos de ejemplo (opcional)

# Verificación / rollback
curl -fsS http://localhost:3000/health    # {"status":"ok","db":true}
APP_IMAGE=<registry>/registro-ayuntamiento:<sha-anterior> docker compose up -d
```
Secretos por entorno (nunca en la imagen), backup (`mongodump` + volumen `uploads`),
TLS en reverse proxy: ver `DEPLOYMENT.md`. El "qué" en `PROMPT.md §9`.

## 📒 Documentación viva (obligación del agente)
Tras cada cambio relevante: actualizar `README.md`/`QUICKSTART.md` si cambia el
arranque, y registrar **problema → causa → solución** en `RETROSPECTIVA.md`.

## 🔁 Repositorios (sincronización obligatoria)
El proyecto se sube a **ambos** remotes, siempre en sincronía:
- GitHub: `https://github.com/OSCARJORGERAPP/registro-ayuntamiento`
- GitLab: `https://gitlab.codecrypto.academy/ojrapp/registro-ayuntamiento`

Antes de subir: `.gitlab-ci.yml` configurado y en verde, tests al 100%, build sin
warnings críticos, `.gitignore` y `package-lock.json` commiteados.
