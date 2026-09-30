# GestionTec Academias

Plataforma SaaS multitenant de GESTIONTEC para la gestión administrativa y académica de academias (música, danza, idiomas, artes, deportes, y otras instituciones de formación).

## Estado actual

Proyecto en etapa inicial de desarrollo. Ver el historial de la conversación de diseño para el detalle completo de arquitectura, modelo de datos, multitenancy, planes y roadmap.

## Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript vanilla (sin frameworks)
- **Backend**: Node.js + Express (CommonJS)
- **Base de datos**: PostgreSQL
- **Autenticación**: JWT + bcrypt

## Estructura del proyecto

```
backend/     API REST (Express), lógica de negocio, acceso a datos
frontend/    Panel administrativo y página pública, separados físicamente
database/    Documentación del modelo de datos
```

## Instalación local

```bash
cd backend
npm install
cp .env.example .env   # completar con las credenciales locales
npm run migrate         # corre las migraciones
npm run dev              # levanta el servidor con recarga automática
```

## Variables de entorno

Ver `backend/.env.example`. Nunca commitear el archivo `.env` real.
