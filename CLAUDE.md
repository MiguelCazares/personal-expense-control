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

Las suites e2e comparten **una sola base de test y la truncan** en `beforeAll`
(`test/helpers/reset-db.ts`). Por eso `--runInBand` no es opcional, y por eso no se puede
tener dos corridas de jest a la vez contra la misma DB: se borran los datos entre ellas y
salen fallos fantasma. Si ves un fallo raro e irreproducible, revisa que no haya quedado un
jest vivo (`pkill -f jest`). Al agregar tablas nuevas, súmalas al TRUNCATE del helper o la
limpieza dejará residuos.

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

## Modelo de dominio

La distinción que sostiene todo el diseño: **`categories` es clasificación, `commitments` es la
regla de recurrencia y `commitment_occurrences` es la instancia mensual.** "Tarjeta AMEX" no es
una categoría con fecha: es un `commitment` con `due_day = 11` que materializa una ocurrencia
por período. Las alertas cuelgan de la ocurrencia, nunca de la categoría, porque es la ocurrencia
la que tiene estado (`PENDING`/`PAID`/`OVERDUE`) y monto propio del mes.

### Lo que ya existe (F1)

**`transactions` es una sola tabla** con discriminador `type` (`INCOME`/`EXPENSE`), no dos. El
resumen mensual sale de una query con `GROUP BY category`, no de un UNION.

**El cliente nunca manda el `type` de un movimiento**: lo dicta la categoría
(`TransactionsService.resolveCategory`). Así es imposible registrar un ingreso contra una
categoría de egreso, y `transaction.type` queda como copia denormalizada que permite filtrar y
sumar sin joinear `categories`.

**`occurred_on` es `date`, no `timestamptz`**, y TypeORM lo devuelve como `'YYYY-MM-DD'`. Un
gasto del día 1 a las 23:00 en México caería en el día 2 en UTC y se contaría en el mes
equivocado. Por lo mismo, todo el cálculo de periodos vive en `summary/utils/period.util.ts` con
aritmética de strings y fechas UTC, y el mes en curso se resuelve con la `timezone` **del
usuario** (por eso `SummaryController` recibe `@CurrentUser()` y no solo `@UserId()`).

**Las categorías con movimientos no se borran, se archivan.** `DELETE` responde 409 si hay
histórico detrás; el camino es `PATCH { isArchived: true }`. Una categoría archivada no admite
movimientos nuevos pero sigue sumando en los resúmenes de meses cerrados.

**El nombre es único por usuario y tipo, sin distinguir mayúsculas.** Lo garantiza un índice de
expresión (`lower(name)`) que solo existe en la migración; el service valida antes para dar un
409 con mensaje decente en vez de un 23505 crudo.

Los montos van en `decimal(12,2)` con `numericTransformer`; sin él Postgres los devuelve como
string. En agregaciones con `getRawMany()` los `SUM` y `COUNT` llegan igual como string y hay
que convertirlos a mano.

Cuidado con `groupBy('1')` en el query builder: TypeORM reordena la lista del `SELECT` y el
ordinal termina apuntando a otra columna. Agrupa siempre por la expresión completa.

### Compromisos y vencimientos (F2)

**Materializar es idempotente por diseño.** `OccurrenceMaterializerService` inserta con
`orIgnore()` apoyado en `UNIQUE(commitment_id, period)`, así que correr el cron dos veces el
mismo día no duplica ni pisa montos ya ajustados a mano. Es lo que permite materializar también
al crear o editar un compromiso sin coordinar nada con el cron.

**Nunca se materializa hacia atrás.** `plannedPeriods()` arranca en el mayor entre
`startPeriod` y el mes actual: dar de alta hoy un préstamo que empezó en enero no inventa ocho
meses de deuda retroactiva. Si el compromiso arranca en el futuro, se materializa desde su
primer mes.

**`OccurrencesService.recalculate()` es la única puerta que cambia el estado de pago.** Crear,
editar, mover o borrar una transacción enlazada pasa por ahí; `paidAmount` sale siempre de
`SUM(transactions)` y nunca se escribe a mano. Al mover un pago de un vencimiento a otro hay que
recalcular **los dos** — por eso `update()` guarda el `occurrenceId` anterior antes del
`Object.assign`.

**`SKIPPED` es terminal.** Ni el recálculo ni el cron de vencidas lo reabren; solo el usuario,
con `PATCH { status: 'PENDING' }`.

**Sin `expectedAmount`, cualquier pago liquida.** Una tarjeta cuyo corte aún no llega no tiene
monto contra el cual comparar, así que un pago > 0 la marca `PAID` en vez de dejarla `PARTIAL`
para siempre.

Los crons viven en `occurrences-scheduler.service.ts`, protegidos con `pg_try_advisory_xact_lock`
igual que `subscription-scheduler.service.ts` de `ms-payments`. Iteran usuario por usuario porque
el "hoy" y el "mes actual" dependen de la `timezone` de cada uno.

En `OccurrencesController`, la ruta `upcoming` va declarada **antes** que `:id`, o `ParseIntPipe`
se comería la palabra.

### Lo que falta (F3-F4)

- `alerts` colgando de la ocurrencia, con `UNIQUE(occurrence_id, kind, days_before, channel)`
  para idempotencia — mismo espíritu que la tabla `webhook_events` de `ms-payments`.
- Cron diario que lea `commitment.alertDaysBefore` (ya está en la tabla) y mande por Telegram.
- `users.telegram_chat_id` ya existe; falta el endpoint para poblarlo.
- Presupuestos por categoría y reportes.

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
