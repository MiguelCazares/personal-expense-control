# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

`README.md` cubre setup, endpoints y variables de entorno. Este archivo documenta la mecánica
arquitectónica y lo que no se ve a primera vista.

## Contexto

Control de gastos personales. **No es un microservicio de invoixup**: comparte el esqueleto de
`ms-payments` (config por dominio con Joi, `infrastructure/`, migraciones explícitas, jsend,
pino, throttler) pero corre solo, sin Stripe, sin Kafka y sin `client-gateway` delante.

## Comandos

```bash
pnpm run start:dev          # desarrollo con watch
pnpm run lint:check         # eslint estricto (lo usa CI; `lint` autocorrige)
pnpm run dev:check          # lint + format + unit + e2e — correr antes de push
```

### Tests — las migraciones se aplican primero

`pnpm test` y `pnpm run test:e2e` corren `migration:run` contra la DB de test **antes** de jest.
Invocar `jest` directo se salta ese paso y cualquier cambio de esquema recién agregado revienta
el e2e con `column ... does not exist`. Tras tocar una entidad, corre el `pnpm test` completo o
aplica la migración a mano primero:

```bash
NODE_ENV=test pnpm run migration:run
NODE_ENV=test npx jest src/auth/auth.service.spec.ts     # un archivo
NODE_ENV=test npx jest -t "closes registration"          # un test por nombre
```

ts-jest corre en modo transpile-only, gobernado por `isolatedModules: true` en `tsconfig.json`
(no hay bloque `transform` en `jest.config.ts`). No lo quites: construir el programa completo de
TypeScript se pasa del techo de heap del runner de CI y el job muere con OOM (exit 134). Los
tipos los cubren `nest build` y typescript-eslint.

### Dependencias con versión fijada a propósito

`@nestjs/jwt` y `@nestjs/passport` están pinneados a `^11` (igual que `client-gateway` y
`ms-auths`). Las v12 son **ESM-only** y jest, que corre en CommonJS, revienta al cargarlas con
`Must use import to load ES Module`. No subas esas dos hasta migrar jest a ESM.

### Migraciones

Viven en `database/migrations/` (NO en `src/`), las carga `src/infrastructure/data-source.ts`.
Las entidades corren con `synchronize: false`, así que **cada cambio de esquema necesita su
migración**. El timestamp de una migración nueva debe ser mayor al de la última existente.

```bash
pnpm run migration:generate database/migrations/<nombre>   # diff entidades vs DB
pnpm run migration:create database/migrations/<nombre>     # migración vacía
```

## Arquitectura

**Auth: JWT propio, guard global.** `JwtAuthGuard` está registrado como `APP_GUARD` en
`AppModule`, así que **todo endpoint nace protegido**. Para abrir uno hay que marcarlo con
`@Public()` (`src/common/decorators/public.decorator.ts`) — hoy solo `/api/health`,
`/api/auth/register` y `/api/auth/login`. `JwtStrategy.validate()` relee el usuario de la DB en
cada request en vez de confiar en el payload, para que desactivar la cuenta invalide los tokens
vivos de inmediato.

**El registro se cierra solo.** `AuthService.register()` solo procede si `users` está vacía. Es
el sustituto de una bandera de entorno: da de alta al propietario en el primer arranque y
después responde `403`. Al agregar tests que registren usuarios, limpia la tabla en `beforeAll`.

**`passwordHash` tiene `select: false`.** Ningún `findOne` normal la trae; el login la pide
explícitamente en su `select`. Cualquier respuesta al cliente pasa por
`AuthService.toPublicUser()`, que es lo que garantiza que el hash no se filtre.

**El scope siempre es el usuario.** Toda tabla de dominio lleva `user_id` y todo controller
resuelve el dueño con `@UserId()` (`src/common/decorators/user-id.decorator.ts`), el equivalente
al `@BusinessId()` del `client-gateway`. Nunca aceptes un `userId` del body o del query: sale
del token o no sale.

## Modelo de dominio (F1-F3, aún por construir)

La distinción que sostiene todo el diseño: **`categories` es clasificación, `commitments` es la
regla de recurrencia y `commitment_occurrences` es la instancia mensual.** "Tarjeta AMEX" no es
una categoría con fecha: es un `commitment` con `due_day = 11` que materializa una ocurrencia
por período. Las alertas cuelgan de la ocurrencia, nunca de la categoría, porque es la ocurrencia
la que tiene estado (`PENDING`/`PAID`/`OVERDUE`) y monto propio del mes.

- `transactions` es **una sola tabla** con discriminador `type` (`INCOME`/`EXPENSE`), no dos.
  El balance mensual es una query, no un UNION.
- Los montos van en `decimal(12,2)` con `numericTransformer`; sin él, Postgres los devuelve
  como string.
- Los crons (materializar ocurrencias, marcar vencidas, disparar alertas) se protegen con
  `pg_try_advisory_xact_lock`, igual que `subscription-scheduler.service.ts` de `ms-payments`.
- `due_day = 31` se recorta al último día del mes.

## Transversal

- **Config:** archivos por dominio en `src/config/`, cada uno con su esquema Joi, mergeados en
  `AppModule`. Lee siempre con `ConfigService.get('<namespace>.<key>')`, nunca `process.env`
  directo (excepto en `data-source.ts` e `instrument.ts`, que corren fuera del contenedor de Nest).
- **Validación:** `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted`; los fallos
  devuelven **422**, no 400.
- **Routing:** prefijo `/api` escrito en cada `@Controller`. Swagger en `/api/docs` (apagado en
  producción).
- **Respuestas:** `ResponseHelper.jsendSuccess(data, status?)`. El front lee el token en
  `/data/access_token`, así que la forma de la respuesta de login es contrato.
- Conventional commits forzados por commitlint + husky.
