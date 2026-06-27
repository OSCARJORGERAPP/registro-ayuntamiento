# QUICKSTART — De cero a corriendo en < 5 min

> Requisitos: Node.js LTS, Docker (para MongoDB y MailHog). <!-- TODO confirmar versiones -->

```bash
# 1. Dependencias
npm install

# 2. Servicios locales
docker run -d --name registro-mongo -p 27017:27017 mongo:7
docker run -d --name registro-mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog

# 3. Variables de entorno
cp .env.example .env       # valores por defecto sirven para dev local

# 4. Datos de ejemplo
npm run seed

# 5. Arrancar
npm run dev
```

Luego:
- App: http://localhost:3000  <!-- TODO confirmar puerto -->
- Magic links (bandeja de email dev): http://localhost:8025

## Probar el flujo
1. Inicia sesión con un email de contribuyente del seed → abre el magic link en MailHog.
2. Presenta una **instancia general** (Expone / Solicita + adjunto).
3. Inicia sesión como **funcionario** → abre la presentación → crea un **expediente**.
4. Añade una **actuación** al expediente.

<!-- TODO: ajustar credenciales/emails de ejemplo a los que cree el seed -->
