# REFLEXIÓN FINAL

> Cierre del proyecto Registro Municipal. El "qué" está en `PROMPT.md` y el "cómo"
> en `AGENTS.md`; aquí se recoge el balance: qué se entregó, por qué se decidió así,
> qué queda pendiente y qué se aprendió.

## Qué se logró
- **RF-01..RF-10 implementadas**, cada una con ≥1 test (magic link, roles y
  autorización en servidor, instancia general con adjuntos, consulta del
  contribuyente, vista del funcionario, expedientes, actuaciones, consulta de
  expediente, multi-área y home por área).
- **Suite en verde:** 38 tests unit/integración + 4 e2e Playwright (chromium),
  reproducibles contra MongoDB local y en CI.
- **Observabilidad propia sin dependencias:** `GET /metrics` (latencias p50/p95/p99
  por ruta, ops Mongo vía command monitoring, tamaños por colección y proceso) y
  `npm run loadtest`. Baseline medido el 2026-06-27: 457 req/s, 0 errores, p95 ~180 ms
  a concurrencia 50; latencia API y respuesta Mongo dentro de umbral.
- **Entregables documentales y de operación:** `README.md`, `QUICKSTART.md`,
  `AGENTS.md`, `RETROSPECTIVA.md`, seed (`npm run seed`), `.env.example`,
  `package-lock.json`, `.gitlab-ci.yml`, `Dockerfile` + `docker-compose.yml`,
  `DEPLOYMENT.md` y diagrama de arquitectura (Mermaid en el README).

Pendientes conocidos al cierre: pipeline CI corriendo en verde en GitLab, prueba de
concurrencia a 100 y despliegue en un host público real (ver *Deuda técnica*).

## Producto Mínimo Viable (MVP)
El MVP cubre el ciclo completo **presentar → tramitar → consultar** para un
ayuntamiento, en formato SaaS multi-área:

- **Acceso sin contraseña** por magic link (token de un solo uso, 15 min de validez).
- **Dos roles** —contribuyente y funcionario— con autorización verificada en servidor.
- **Instancia general:** interesado (nombre + dirección fiscal), representante
  opcional, *Expone*, *Solicita* y adjuntos; con sello de entrada y número de registro.
- **Consulta del contribuyente:** ve solo sus presentaciones, estado y adjuntos.
- **Tramitación del funcionario:** todas las presentaciones de su(s) área(s),
  creación de **expedientes** (código único) y **actuaciones** cronológicas e inmutables.
- **Multi-área (SaaS):** áreas con funcionarios asignados y home personalizable por área.

Deliberadamente **fuera del MVP** (ver *Próximos pasos*): firma electrónica
cualificada, integración SIR/ORVE, pagos de tasas, registro de salida y app móvil.
El criterio fue entregar trazabilidad de extremo a extremo antes que cobertura legal
completa: con magic link y registro de entrada se valida el flujo; la firma y las
integraciones oficiales son endurecimiento posterior, no requisito para demostrar valor.

## Decisiones de diseño
- **MongoDB con driver nativo (sin ODM).** Las presentaciones tienen campos variables
  y adjuntos; el documento flexible encaja mejor que un esquema rígido. Sin ODM las
  consultas e índices son explícitos, la dependencia es más ligera y no hay "magia"
  que depurar. Coste asumido: más boilerplate y validación manual.
- **Magic link como autenticación.** Evita gestionar contraseñas (hashing, reset,
  fugas) y se alinea con una sede electrónica simple. Token con hash en BD, un solo
  uso y expiración por TTL. Limitación conocida: no equivale a firma cualificada.
- **Autorización en el servidor por rol y área.** La UI no es fuente de verdad
  (RF-02/RF-09): cada acción comprueba rol y pertenencia al área. El contribuyente
  nunca ve presentaciones ajenas; el funcionario solo opera sus áreas.
- **Multi-área desde el modelo, no como parche.** `areas` + `usuarios.areas[]`
  permiten home y operativa por área sin tocar el código por cada ayuntamiento.
- **Vistas server-rendered + JS ligero.** Menos superficie y sin paso de build
  pesado para un MVP; el `build` es un no-op documentado.
- **Adjuntos en disco local abstraídos** (multer, límite ≤ 10 MB) para poder migrar
  a object storage S3-compatible sin reescribir el dominio.
- **Métricas propias en `src/metrics.js`, sin dependencias.** Suficiente para fijar
  baselines y un punto de degradación; exportable a Prometheus/OTel en producción.
- **Aislamiento de BD por archivo de test.** Cada archivo de integración usa su
  propia base (sufijo único en `setup()`) para evitar carreras (ver `RETROSPECTIVA.md`).

## Deuda técnica
- **Autenticación solo magic link:** no hay firma electrónica/certificado digital,
  imprescindible para validez jurídica plena en sede electrónica.
- **Adjuntos en disco local:** la abstracción existe, pero falta el backend de object
  storage (S3-compatible) y una política de retención/antivirus.
- **Despliegue fuera de banda:** la instancia de GitLab no tiene Container Registry
  (`/v2` → 404), así que CI solo **construye** la imagen (job `docker-image`) y el
  push está deshabilitado; publicar es manual (`build` local + `docker compose`).
- **Concurrencia validada a 50, no a 100:** el objetivo (≥100 sin degradación > 20%)
  está sin medir en un entorno representativo.
- **Sin despliegue público real:** faltan dominio, TLS en reverse proxy y la medición
  de disponibilidad/RPO/RTO; hoy solo está verificado en local con health check.
- **Endurecimiento de producción pendiente:** entrega de email real (no MailHog),
  gestión de secretos por entorno y backup automatizado (`mongodump` + volumen).
- **Disciplina de tests frágil:** el aislamiento por BD depende de recordar el sufijo
  único en cada archivo nuevo de integración; conviene factorizarlo o forzarlo.

## Aprendizajes
- **`node --test` ejecuta los archivos en paralelo.** Compartir la BD de test entre
  archivos produce fallos intermitentes (1/38) difíciles de reproducir; la solución
  fue una BD por archivo. Lección: aislar el estado externo *antes* de paralelizar.
- **El driver nativo da control a cambio de trabajo.** Índices, validación y forma de
  los documentos se vuelven responsabilidad explícita del código y de los tests.
- **Las métricas propias rinden:** con poco código (latencias + command monitoring +
  `collStats`) se obtienen baselines accionables sin montar un stack de observabilidad.
- **El entorno de CI condiciona el diseño de deploy:** descubrir que la instancia no
  tenía Container Registry obligó a separar "validar imagen" (CI) de "publicar"
  (fuera de banda) y a documentarlo en `AGENTS.md`/`DEPLOYMENT.md`.
- **Documentar el "porqué" en caliente** (RETROSPECTIVA, este cierre) evita perder el
  contexto de decisiones que luego parecen arbitrarias.

## Próximos pasos
- **Firma electrónica cualificada / certificado digital** para validez jurídica.
- **Integración con plataformas oficiales:** SIR/ORVE y notificaciones electrónicas.
- **Pagos de tasas** (pasarela) asociados a la presentación.
- **Registro de salida** y notificaciones fehacientes.
- **Object storage para adjuntos** (S3-compatible) con retención y análisis antivirus.
- **Despliegue público real:** dominio + TLS, y un registry (propio o alternativo)
  para publicar la imagen desde CI en lugar de hacerlo a mano.
- **Cerrar las métricas pendientes:** prueba de concurrencia a 100 y medición real de
  disponibilidad/RPO/RTO; exportar `/metrics` a Prometheus/OTel.
- **App móvil nativa** como canal adicional del contribuyente.
