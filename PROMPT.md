# Registro Municipal — Especificación

> SaaS de **registro de entrada** y tramitación para ayuntamientos: los
> contribuyentes presentan documentos (instancia general) y los funcionarios los
> tramitan mediante expedientes y actuaciones.

## 1. Objetivo
Dar a cualquier administración pública (ayuntamiento) una solución digital para que
el contribuyente interactúe con ella: presentar documentos por sede electrónica y
seguir su tramitación, mientras los funcionarios gestionan lo presentado mediante
expedientes y actuaciones. Resuelve la presentación presencial en papel y la falta
de trazabilidad del estado de cada solicitud.

## 2. Alcance
- **Incluido (MVP):**
  - Autenticación por **magic link** (sin contraseña).
  - Dos roles: **contribuyente** y **funcionario**.
  - Presentación de documentos, empezando por la **instancia general**.
  - Consulta de lo presentado por parte del contribuyente.
  - Vista de todas las presentaciones por parte del funcionario.
  - Creación de **expedientes** asociados a una presentación.
  - **Actuaciones** (fecha + texto) sobre un expediente.
  - **Multi-área (SaaS):** home personalizable por área de gestión y asignación de
    los funcionarios que la operan.
- **Fuera de alcance (por ahora):**
  - Firma electrónica cualificada / certificado digital (solo magic link en MVP).
  - Integración con plataformas oficiales (SIR/ORVE, notificaciones electrónicas).
  - Pagos de tasas / pasarela de pago.
  - Registro de salida y notificaciones fehacientes.
  - App móvil nativa.

## 3. Stack tecnológico
- **Backend:** Node.js + Express — API REST sencilla y madura para un MVP.
- **Base de datos:** **MongoDB con driver nativo** (sin ODM) — modelo flexible para
  presentaciones con campos variables y adjuntos; consultas directas y explícitas.
- **Auth:** **magic link** por email (token de un solo uso con expiración) — sin
  gestión de contraseñas, alineado con sede electrónica simple.
- **Email (dev):** MailHog / SMTP local para capturar los magic links en desarrollo.
- **Frontend:** vistas server-rendered + JS ligero; menú de navegación desde la
  landing, home personalizable por área.
- **Almacenamiento de adjuntos:** disco local en dev (carpeta `uploads/`),
  abstraído para poder migrar a object storage (S3-compatible) en producción.
- **Tests:** unitarios + integración + **e2e con Playwright**.
- **CI/CD:** `.gitlab-ci.yml` (install → lint → test → build → deploy) + GitHub.

## 4. Requisitos funcionales
Cada RF es verificable y tiene su criterio de aceptación (CA).

- **RF-01 — Autenticación por magic link.** El usuario introduce su email; el sistema
  envía un enlace con token de un solo uso y expiración; al abrirlo se crea sesión.
  *CA:* un token usado o caducado no autentica; un token válido crea sesión y redirige
  según el rol.
- **RF-02 — Roles y autorización.** Cada usuario es **contribuyente** o **funcionario**.
  *CA:* un contribuyente no puede acceder a vistas/acciones de funcionario y viceversa
  (autorización verificada en servidor, no solo en UI).
- **RF-03 — Presentar instancia general.** El contribuyente presenta una instancia con:
  nombre y **dirección fiscal del interesado**, **nombre del representante** (opcional),
  **Expone** (textarea), **Solicita** (textarea) y **archivos adjuntos**.
  *CA:* al presentar se asigna fecha/sello de entrada y queda asociada al contribuyente;
  los campos obligatorios se validan en servidor.
- **RF-04 — Consulta del contribuyente.** El contribuyente ve **solo** las
  presentaciones que él ha realizado, con su estado y adjuntos.
  *CA:* no ve presentaciones de otros contribuyentes.
- **RF-05 — Vista del funcionario.** El funcionario ve **todas** las presentaciones
  dirigidas a su(s) área(s) de gestión.
  *CA:* puede abrir cualquier presentación de su área y descargar sus adjuntos.
- **RF-06 — Crear expediente.** El funcionario puede crear un **expediente** asociado
  a una presentación cuando lo considere necesario. El expediente se identifica por
  **código**, **tipo de expediente**, **fecha de creación** y **contribuyente**.
  *CA:* el código es único; el expediente queda enlazado a la presentación de origen.
- **RF-07 — Actuaciones.** El funcionario registra **actuaciones** sobre un expediente,
  cada una con **fecha** y **texto**.
  *CA:* las actuaciones se listan en orden cronológico y son inmutables una vez creadas.
- **RF-08 — Consulta de expediente.** Se puede consultar un expediente con su código,
  tipo, fecha, contribuyente, presentación de origen y todas sus actuaciones.
  *CA:* la vista muestra la traza completa.
- **RF-09 — Multi-área (SaaS).** Existen **áreas de gestión**; cada área tiene asignados
  uno o varios **funcionarios** que la operan.
  *CA:* un funcionario solo opera las áreas a las que está asignado.
- **RF-10 — Home personalizable por área.** La home de cada área se puede personalizar
  (p. ej. nombre/identidad del área y los funcionarios que la operan).
  *CA:* dos áreas distintas muestran homes distintas según su configuración.

## 5. Requisitos no funcionales (medibles)
Cada uno con su OBJETIVO numérico (se mide en §8). *Baseline medido el 2026-06-27
en local (1 instancia, MongoDB local, `GET /` con consulta a Mongo, `npm run loadtest`
a concurrencia 50).*

| Requisito | Objetivo | Baseline medido |
|---|---|---|
| Latencia API p95 (consulta) | < 300 ms | ~130 ms (`GET /` bajo carga) ✅ |
| Respuesta MongoDB p95 (find/insert) | < 50 ms | 40 ms (`find`) ✅ |
| Concurrencia sin degradación > 20% | ≥ 100 usuarios | 50 conc → 457 req/s, 0 errores, p95 ~180 ms (falta probar 100) |
| Tamaño por documento (sin adjuntos) | instancia < 16 KB | 419 B presentación · 127–181 B resto ✅ |
| Adjuntos | individual ≤ 10 MB; total ≤ 25 MB | límite ≤ 10 MB aplicado (multer) |
| Magic link | token 15 min, un solo uso | implementado (TTL + `usado`) ✅ |
| Disponibilidad / RPO / RTO | 99.5% · RPO ≤ 24 h · RTO ≤ 4 h | pendiente (depende del deploy §9) |

## 6. Modelo de datos (MongoDB)
Colecciones previstas (atributos mínimos; se pueden añadir los necesarios):

- **areas** — `{ _id, codigo, nombre, config_home, activo }`
  Índice: `codigo` (único).
- **usuarios** — `{ _id, email, rol: "contribuyente"|"funcionario", nombre, areas: [areaId], creado }`
  Índice: `email` (único).
- **magic_tokens** — `{ _id, email, tokenHash, expiraEn, usado }`
  Índice: `tokenHash` (único), TTL sobre `expiraEn`.
- **presentaciones** — `{ _id, contribuyenteId, areaId, tipo: "instancia_general",
  interesado: { nombre, direccionFiscal }, representante?, expone, solicita,
  adjuntos: [{ nombre, ruta, mime, tamano }], fechaEntrada, numeroRegistro, estado }`
  Índices: `contribuyenteId`, `areaId`, `numeroRegistro` (único).
- **expedientes** — `{ _id, codigo, tipo, fechaCreacion, contribuyenteId,
  presentacionId, areaId }`
  Índice: `codigo` (único), `presentacionId`.
- **actuaciones** — `{ _id, expedienteId, fecha, texto, funcionarioId }`
  Índice: `expedienteId`.

Tamaño medido por documento (`GET /metrics` → `datos`, 2026-06-27): áreas 127 B,
usuarios 147 B, presentaciones 419 B (sin adjuntos), expedientes 181 B, actuaciones
153 B. Crecimiento dominado por adjuntos (fuera del documento) y por el histórico de
actuaciones por expediente.

## 7. Entregables documentales (OBLIGATORIOS)
Estado real detectado en el repo (2026-06-26):

| Entregable | Propósito | Estado |
|---|---|---|
| `PROMPT.md` | Especificación del producto (este archivo) | ✅ |
| `AGENTS.md` | Guía operativa para agentes/devs | ✅ |
| `README.md` | Visión general, instalación, arranque, arquitectura | 🟡 funcional |
| `QUICKSTART.md` | "De cero a corriendo" en < 5 min | 🟡 funcional |
| `RETROSPECTIVA.md` | Bitácora problema → causa → solución | 🟡 stub |
| `REFLEXION-FINAL.md` | Cierre: logros, decisiones, deuda técnica | 🟡 stub |
| Tests automatizados | 33 unit/integración + 4 e2e Playwright (chromium), todos ✅; e2e activos en CI | ✅ |
| Seed de datos (`npm run seed`) | Áreas, usuarios, presentaciones, expedientes de ejemplo | ✅ |
| `.env.example` | Plantilla de variables de entorno | ✅ |
| `package-lock.json` | Dependencias bloqueadas (commiteado) | ✅ |
| `.gitlab-ci.yml` | Pipeline install → lint → test → e2e → package (build imagen) | ✅ |
| `Dockerfile` + `docker-compose.yml` | Imagen de producción y stack reproducible | ✅ |
| Diagrama de arquitectura | En README (Mermaid) | ✅ |
| Sección de métricas | `GET /metrics` (latencias, ops Mongo, tamaños, proceso) + `npm run loadtest` | ✅ |
| Guía de deployment público | `DEPLOYMENT.md` (secretos, rollback, backup, health) | ✅ |

> Esqueleto verificado contra MongoDB local: 38 tests en verde (RF-01..RF-10 +
> métricas) y 4 e2e Playwright; `/metrics` y `npm run loadtest` validados en vivo
> (457 req/s, 0 errores, p95 ~180 ms a concurrencia 50).

Leyenda: ✅ hecho · 🟡 stub/parcial · ⬜ pendiente.

## 8. Métricas y observabilidad
Implementado en `src/metrics.js` y expuesto en **`GET /metrics`** (JSON):
- **`http.por_ruta`** — latencias p50/p95/p99 + count + errores por endpoint (ids
  normalizados a `:id`), más `total` y `tasa_error`.
- **`mongo_ops`** — tiempo real por operación (find/insert/update…), capturado vía
  *command monitoring* del driver.
- **`datos`** — tamaño de objetos por colección (`avgObjSize`, `storageSize`, count).
- **`proceso`** — RSS, heap usado y CPU; `uptime_s`.

Concurrencia y punto de degradación: **`npm run loadtest [url] [conc] [total]`**
(sonda sin dependencias que reporta throughput y p50/p95/p99). Baselines en §5.
En producción, estos mismos puntos de registro pueden exportarse a Prometheus/OTel.

## 9. Deployment público
Modelo: **imagen Docker**. CI valida que la imagen construye (job `docker-image`); la
**publicación es fuera de banda** porque esta instancia de GitLab no tiene Container
Registry (`/v2` → 404) — build local y `docker compose` en el host. Guía: [`DEPLOYMENT.md`](DEPLOYMENT.md).
- **Entorno objetivo:** `production` (+ `staging`/`demo` opcional).
- **Plataforma:** contenedor Docker (Node 20 alpine, no root) sobre cualquier host con
  Docker; MongoDB en compose o gestionado (Atlas). Verificado en local con compose.
- **Dominio(s) + TLS:** reverse proxy (Caddy/Nginx/Traefik) delante. <!-- TODO dominio real -->
- **Secretos/variables:** `SESSION_SECRET`, `APP_URL`, `MONGODB_URI`/`MONGODB_DB`,
  `MAIL_*`; volumen para adjuntos. Inyectados por entorno (no en la imagen).
- **Estrategia de actualización:** redeploy por tag inmutable (SHA); rollback al tag previo.
- **Inicialización:** índices Mongo automáticos al arrancar (`ensureIndexes`); seed opcional.
- **Backup / DR:** `mongodump` + volumen `uploads`; RPO/RTO de §5.

## 10. Criterios de aceptación del proyecto
- [x] Todas las RF (01–10) implementadas con ≥1 test cada una.
- [ ] Todos los entregables del §7 presentes y completos.
- [x] Tests en verde (unit + integración + e2e Playwright).
- [ ] Pipeline CI en verde (lint → test → e2e → image) — pendiente de correr en GitLab.
- [x] Métricas de §5/§8 medidas y dentro de umbral (baseline 2026-06-27; falta probar
  concurrencia 100 en el entorno de deploy).
- [~] Deployment reproducible (Docker + compose) verificado con health check en local;
  falta el despliegue en un host público real (dominio/TLS).
