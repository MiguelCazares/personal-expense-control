# ms-expenses

API de **control de gastos personales**: ingresos y egresos por categoría, compromisos fijos
(tarjetas de crédito, préstamos, servicios) y alertas de vencimiento por Telegram.

NestJS 11 + TypeORM (PostgreSQL) + JWT. La estructura sigue la de `ms-payments` de invoixup
(config por dominio validada con Joi, migraciones explícitas, respuestas jsend, Swagger, pino),
pero es un servicio independiente: sin Stripe, sin Kafka y sin gateway.

## Requisitos

- Node `v24.15.0` (ver `.nvmrc`)
- pnpm
- Docker (para las bases de datos)

## Puesta en marcha

```bash
cp .env.example .env
pnpm run generate:jwt-secret   # pega el valor en JWT_SECRET
docker compose up -d           # levanta la DB (53010) y la de test (53110)
pnpm install
pnpm run migration:run
pnpm run start:dev
```

El servicio queda en `http://localhost:3010` y Swagger en `http://localhost:3010/api/docs`.

### Crear tu usuario

El proyecto es mono-usuario: `POST /api/auth/register` **solo funciona mientras la tabla
`users` está vacía**. La primera llamada crea al propietario y cierra el endpoint; a partir
de ahí devuelve `403`. No hay que activar ninguna bandera.

```bash
curl -X POST http://localhost:3010/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"tu@correo.com","password":"una-contraseña-larga","name":"Tu nombre"}'
```

La respuesta trae `data.access_token`; se manda como `Authorization: Bearer <token>` en el
resto de los endpoints.

## Comandos

```bash
pnpm run start:dev      # desarrollo con watch
pnpm run build          # nest build
pnpm run lint:check     # eslint estricto (lo usa CI; `lint` autocorrige)
pnpm run format:check   # prettier check; `format` autocorrige
pnpm test               # migra la DB de test y corre los unitarios
pnpm run test:e2e       # migra la DB de test y corre los e2e
pnpm run dev:check      # lint + format + unit + e2e — correr antes de push
```

### Sembrar las categorías base

Una vez creado el usuario, `pnpm run seed:run` carga un set inicial (Nómina, Freelance,
Tarjeta AMEX, Tarjeta BBVA, Préstamo 1 y 2, Renta, Servicios, Supermercado, Transporte,
Restaurantes, Salud). Es idempotente: se salta las que ya existan, así que puedes volver a
correrlo tras agregar entradas a `database/seeds/default-categories.ts`.

## Endpoints

Todo lo que no diga «pública» exige `Authorization: Bearer <token>` y se acota solo a los datos
del usuario del token.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Health check con ping a la DB (pública) |
| `POST` | `/api/auth/register` | Alta del propietario, solo con la tabla vacía (pública) |
| `POST` | `/api/auth/login` | Devuelve `{ access_token, user }` (pública) |
| `GET` | `/api/auth/me` | Usuario del token |
| `POST` | `/api/categories` | Crea una categoría |
| `GET` | `/api/categories` | `?name=&type=&nature=&includeArchived=&page=&limit=` |
| `GET` | `/api/categories/:id` | Detalle |
| `PATCH` | `/api/categories/:id` | Actualiza o archiva (`{ isArchived: true }`) |
| `DELETE` | `/api/categories/:id` | Solo si no tiene movimientos; si los tiene, 409 |
| `POST` | `/api/transactions` | Registra un movimiento |
| `GET` | `/api/transactions` | `?type=&categoryId=&from=&to=&search=&page=&limit=` |
| `GET` | `/api/transactions/:id` | Detalle |
| `PATCH` | `/api/transactions/:id` | Actualiza |
| `DELETE` | `/api/transactions/:id` | Borra |
| `GET` | `/api/summary/monthly` | `?period=2026-09` — ingresos, egresos, balance y desglose |
| `GET` | `/api/summary/cashflow` | `?months=6&until=2026-09` — serie mensual |

### Cómo funcionan los movimientos

El `type` de un movimiento (`INCOME`/`EXPENSE`) **no se manda en el payload**: lo determina la
categoría, así que no hay forma de registrar un ingreso contra una categoría de egreso.

```bash
# Un egreso de la tarjeta AMEX
curl -X POST http://localhost:3010/api/transactions \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"amount":1250.50,"occurredOn":"2026-09-11","categoryId":3,"note":"Pago mensualidad"}'

# El resumen del mes
curl "http://localhost:3010/api/summary/monthly?period=2026-09" \
  -H "Authorization: Bearer $TOKEN"
```

`occurredOn` es un día de calendario (`YYYY-MM-DD`), sin hora ni zona: un gasto del día 1 por la
noche cuenta en su mes y no se corre al siguiente por conversión a UTC. El mes «en curso» de
`/api/summary` se resuelve con la `timezone` del usuario.

## Variables de entorno

| Variable | Requerida | Notas |
|---|---|---|
| `NODE_ENV` | no | `local` \| `development` \| `test` \| `production` |
| `PORT` | no | Por defecto `3010` |
| `CORS_ORIGINS` | no | Lista separada por coma; sin definir permite cualquier origen |
| `DB_*` | sí | Host, puerto, usuario, contraseña y nombre de la base |
| `JWT_SECRET` | sí | Mínimo 32 caracteres; genéralo con `pnpm run generate:jwt-secret` |
| `JWT_EXPIRES_IN` | no | Por defecto `90d` |
| `LOG_LEVEL`, `LOG_PATH` | sí | pino + rotación diaria en `logs/` |
| `TELEGRAM_ENABLED` | no | Con `true`, `TELEGRAM_BOT_TOKEN` pasa a ser obligatorio (F3) |
| `ALERTS_CRON_HOUR` | no | Hora local del cron de alertas, por defecto `7` (F3) |
| `SENTRY_DSN` | no | Vacío desactiva el reporte |

## Roadmap

- **F0 — hecho.** Esqueleto, config, infraestructura, auth JWT, health, Swagger, migración inicial.
- **F1 — hecho.** `categories` + `transactions` + resumen mensual y cashflow.
- **F2.** `commitments` + `commitment_occurrences` + crons de materialización y vencidos.
- **F3.** `alerts` + envío por Telegram.
- **F4.** Presupuestos por categoría y reportes.
