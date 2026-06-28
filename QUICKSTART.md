# QUICKSTART — De cero a corriendo en < 5 min

> Requisitos: Node.js 20+ (LTS) y Docker (para MongoDB y MailHog).

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
- App: http://localhost:3000
- Magic links (bandeja de email dev): http://localhost:8025 (también se imprimen en la consola)

## Usuarios del seed
No hay contraseñas: inicia sesión introduciendo el email y abre el magic link.
- **Contribuyentes:** `ana.contribuyente@ejemplo.com`, `luis.contribuyente@ejemplo.com`
- **Funcionarios:** `paco.funcionario@ayto.example` (Urbanismo), `marta.funcionaria@ayto.example` (Hacienda)

## Probar el flujo
1. Inicia sesión como `ana.contribuyente@ejemplo.com` → abre el magic link en MailHog.
2. Presenta una **instancia general** (Expone / Solicita + adjunto).
3. Inicia sesión como `paco.funcionario@ayto.example` (Urbanismo) → abre la presentación → crea un **expediente**.
4. Añade una **actuación** al expediente.
