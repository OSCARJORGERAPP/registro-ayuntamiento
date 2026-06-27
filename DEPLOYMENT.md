# Guía de despliegue — Registro Municipal

Modelo: **CI publica una imagen Docker** en el GitLab Container Registry; el
despliegue se hace **fuera de banda** en el host objetivo con `docker compose`.

> Especificación: [`PROMPT.md`](PROMPT.md) · Operativa: [`AGENTS.md`](AGENTS.md)

## 1. Imagen de producción
El pipeline ([.gitlab-ci.yml](.gitlab-ci.yml)) **construye** la imagen en cada push a
`main` (job `docker-image`) para validar el Dockerfile. **No la publica**: esta
instancia de GitLab no tiene Container Registry (`/v2` → 404), así que la publicación
es manual/fuera de banda.

Build (local o en el host de despliegue):
```bash
docker build -t registro-ayuntamiento:local .
```
Para publicar en un registry propio (Docker Hub, GHCR, etc.), etiqueta y push:
```bash
docker tag registro-ayuntamiento:local <registry>/registro-ayuntamiento:<tag>
docker push <registry>/registro-ayuntamiento:<tag>
```
(En el pipeline, el push está comentado y listo para reactivar si hay registry.)

La imagen: Node 20 alpine, solo dependencias de producción, **usuario no root**,
`HEALTHCHECK` sobre `/health`, expone el puerto 3000.

## 2. Prerrequisitos del host
- Docker + Docker Compose v2.
- Acceso al registry: `docker login <registry>` (token de despliegue de GitLab).
- DNS del dominio apuntando al host y un **reverse proxy con TLS** delante
  (Caddy/Nginx/Traefik) que termine HTTPS y haga proxy a `app:3000`.

## 3. Configuración / secretos
Variables que consume la app ([.env.example](.env.example)):

| Variable | Producción |
|---|---|
| `SESSION_SECRET` | **obligatorio**, aleatorio y secreto (firma de sesión) |
| `APP_URL` | URL pública, p. ej. `https://registro.tu-ayto.es` (los magic links la usan) |
| `MONGODB_URI` / `MONGODB_DB` | Mongo del stack o Atlas gestionado |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_FROM` | **SMTP real** (no MailHog) |
| `MAX_UPLOAD_MB` | límite de adjunto (def. 10) |

No commitear secretos: inyéctalos por entorno o un gestor de secretos.

## 4. Desplegar
```bash
export APP_IMAGE=<registry>/registro-ayuntamiento:<tag>   # o :latest
export SESSION_SECRET=<secreto-fuerte>
export APP_URL=https://registro.tu-ayto.es
export MAIL_HOST=smtp.tu-proveedor  MAIL_PORT=587  MAIL_FROM=registro@tu-ayto.es

docker compose pull            # baja la imagen publicada
docker compose up -d           # arranca app + mongo (mailhog solo con --profile dev)
```
Los **índices de MongoDB se crean solos** al arrancar (`ensureIndexes`). Sin paso
de migración. Datos de demostración opcionales:
```bash
docker compose exec app npm run seed
```

## 5. Verificación post-deploy
```bash
curl -fsS https://registro.tu-ayto.es/health      # {"status":"ok","db":true}
curl -s   https://registro.tu-ayto.es/metrics | jq '.http, .mongo_ops'
```
Smoke manual: solicitar magic link → abrir enlace → presentar instancia →
(funcionario) crear expediente y actuación.

## 6. Actualización y rollback
```bash
# Actualizar a una versión concreta (recomendado fijar SHA, no 'latest')
export APP_IMAGE=<registry>/registro-ayuntamiento:<nuevo-sha>
docker compose pull && docker compose up -d

# Rollback: volver al tag anterior
export APP_IMAGE=<registry>/registro-ayuntamiento:<sha-anterior>
docker compose up -d
```
Estrategia: redeploy por tag (la imagen es inmutable por SHA). `restart: unless-stopped`
mantiene los contenedores tras reinicios del host.

## 7. Backup y recuperación
- **MongoDB** (volumen `mongo-data`):
  ```bash
  docker compose exec -T mongo mongodump --archive --db "$MONGODB_DB" > backup-$(date +%F).archive
  # restore: docker compose exec -T mongo mongorestore --archive < backup.archive
  ```
- **Adjuntos** (volumen `uploads`): copia del volumen (`docker run --rm -v registro-ayuntamiento_uploads:/u …`).
- Objetivos en [`PROMPT.md §5`](PROMPT.md): RPO ≤ 24 h, RTO ≤ 4 h → programar backup diario.

## 8. Notas de seguridad
- Contenedor como **usuario no root**; no exponer Mongo a Internet (sin puerto
  publicado en compose).
- TLS terminado en el reverse proxy; `cookie.secure` se activa con `NODE_ENV=production`.
- Rotar `SESSION_SECRET` invalida sesiones (forzar re-login).
- Para alta disponibilidad/escala: varias réplicas de `app` tras el proxy y MongoDB
  gestionado (Atlas) o réplica set; validar **concurrencia 100** (`npm run loadtest`)
  en el entorno real (pendiente, ver [`PROMPT.md §5`](PROMPT.md)).
