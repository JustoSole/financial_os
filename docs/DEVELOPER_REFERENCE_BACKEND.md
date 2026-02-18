# Backend Developer Reference

Referencia técnica del backend en `backend/` para implementar cambios con rapidez y seguridad.

## Stack y runtime

- Node.js + TypeScript.
- Express para API HTTP.
- Supabase como capa de datos y autenticación.
- Vitest para tests.

Scripts clave (`backend/package.json`):

- `npm run dev --workspace=backend`: modo desarrollo (`tsx watch src/index.ts`).
- `npm run build --workspace=backend`: compilación TypeScript.
- `npm run start --workspace=backend`: ejecución producción.
- `npm run test --workspace=backend`: tests backend.

## Estructura y responsabilidades

### `backend/src/index.ts`

- Inicializa DB (`initializeDatabase()`).
- Configura middleware (`cors`, `express.json`, `compression`).
- Monta rutas en `/api`.
- En producción sirve `frontend/dist` y expone `/env.js`.

### `backend/src/routes/api.ts`

- Router principal de endpoints.
- Aplica autenticación JWT (Supabase) a rutas protegidas.
- Coordina llamadas a servicios (métricas, acciones, costos, importación, etc.).

Endpoints principales (resumen):

- Salud e importación: `/health`, `/import/validate`, `/import`, `/import/batch`, `/import/history/:propertyId`.
- Propiedad: `/property`, `/property/:id`, `/property/:propertyId/reset`.
- Métricas: `/metrics/:propertyId/*` (command-center, cash, channels, collections, structure, reconcile, ar-aging, breakeven, minimum-price, insights, trends, dow, yoy, projections, reservation-economics).
- Acciones: `/actions/:propertyId`, `/actions/:propertyId/completed`, `/actions/:propertyId/step`, `/actions/:propertyId/status`.
- Costos y meta: `/costs/:propertyId`, `/costs/:propertyId/channels`, `/meta/:propertyId/room-types`.
- Otros: `/data-health/:propertyId`, `/telemetry`.
- Operativos admin (protegidos): `/admin/:propertyId/backfill-snapshots`.

### `backend/src/db/`

- `index.ts`: interfaz de operaciones de DB y selección de adaptador.
- `supabase-client.ts`: cliente Supabase (service role/anon) y contexto autenticado.
- `supabase-adapter.ts`: operaciones de lectura/escritura, paginación y upserts.

### `backend/src/parsers/`

- `csv-parser.ts`: parse CSV, delimitador, normalización de números/encodings.
- `transaction-parser.ts`: convierte reportes financieros a tipo interno.
- `reservation-parser.ts`: convierte reportes de reservas a tipo interno.
- `index.ts`: detecta tipo de reporte, valida y delega parser.

### `backend/src/services/`

- `import-service.ts`: orquesta validación + parseo + persistencia.
- `calculation-engine.ts`: núcleo de cálculos consolidados.
- `metrics-service.ts`: métricas por dominio.
- `command-center-service.ts`: composición de métricas estratégicas.
- `reservation-economics-service.ts`: P&L por reserva.
- `projections-service.ts`: proyecciones/pacing.
- `actions-service.ts`: acciones sugeridas y estado de ejecución.
- `insights-service.ts`, `trends-service.ts`: insights y tendencias.
- `cache-service.ts`: caché in-memory con TTL.
- `metrics-core/`: SSOT de fórmulas (overlap, prorrateo, agregación y canales directos).

### `backend/src/scripts/`

- Scripts operativos y de mantenimiento (ej. backfills de datos derivados).
- `backfill-reservation-daily-snapshots.ts`: reconstruye snapshots históricos por import (idempotente).
- `backfill-reservation-daily-snapshots-all.ts`: ejecuta backfill para todas las propiedades.

### `backend/migrations/`

- SQL incremental para cambios de esquema.
- Actualmente incluye room type en transacciones y snapshots diarios de reservas.

## Flujo de datos end-to-end

## 1) Importación de CSV

1. Frontend sube archivo(s) a `/api/import` o `/api/import/batch`.
2. `import-service` parsea CSV, detecta tipo, valida estructura.
3. Se transforma a tipos internos (`ParsedTransaction` / `ParsedReservation`).
4. `supabase-adapter` guarda en lotes y registra historial.
5. En import de reservas, se genera snapshot diario de estadía para pacing histórico exacto.
6. Se limpian entradas de caché para evitar lecturas obsoletas.

## 2) Consulta de métricas

1. Frontend consulta `/api/metrics/:propertyId/...`.
2. El router instancia/usa servicios de métricas.
3. `CalculationEngine` carga datos base de DB + costos.
4. Se calculan KPIs, comparativas y agregaciones.
5. Se cachea respuesta donde aplica para reducir recomputación.

## Snapshot histórico para pacing (DBA exacto)

- Tabla: `reservation_daily_snapshots` (migración: `backend/migrations/create_reservation_daily_snapshots.sql`).
- Clave: `(property_id, snapshot_date, stay_date)`.
- Escritura:
  - **Online**: en cada import de `reservations_financials`.
  - **Backfill CLI**: `npm run backfill:snapshots --workspace=backend -- <propertyId> [limit] [--dry-run]`.
  - **Backfill masivo CLI**: `npm run backfill:snapshots:all --workspace=backend -- [limit] [--dry-run]`.
  - **Reconstrucción as-of CLI (fallback operativo)**: `npm run reconstruct:snapshot:asof --workspace=backend -- <propertyId> <YYYY-MM-DD> [--dry-run]`.
  - **Reconstrucción as-of masiva CLI**: `npm run reconstruct:snapshot:asof:all --workspace=backend -- <YYYY-MM-DD> [--dry-run]`.
  - **Backfill API**: `POST /api/admin/:propertyId/backfill-snapshots` con body `{ limit?, dryRun? }`.
  - **Reconstrucción as-of API**: `POST /api/admin/:propertyId/reconstruct-snapshot-asof` con body `{ snapshotDate, dryRun? }`.
- Lectura:
  - `ProjectionsService` usa snapshot exacto para histórico YoY/as-of.
  - Si no existe snapshot exacto, usa aproximación y expone `pacing.isApproximate = true`.
  - En fallback, también expone `pacing.diagnostics` con:
    - `requestedAsOfSnapshotDate` (fecha exacta requerida),
    - `availableSnapshotDates` (fechas de snapshot realmente disponibles),
    - `missingWeeks`, `totalWeeks`, `exactCoveragePercent`,
    - `importedWeeks`, `reconstructedWeeks`, `approximatedWeeks`.

## Runbook go-live de pacing histórico

1. Aplicar migraciones de snapshots en remoto (`supabase db push`).
2. Ejecutar backfill importado:
   - `npm run backfill:snapshots:all --workspace=backend -- [limit]`.
3. Si falta as-of histórico (ver `requestedAsOfSnapshotDate`), ejecutar reconstrucción:
   - `npm run reconstruct:snapshot:asof:all --workspace=backend -- <YYYY-MM-DD>`.
4. Validar API Projections:
   - `isApproximate` y `diagnostics` por propiedad.
   - `approximatedWeeks` debe tender a `0` tras reconstrucción.

## 3) Acciones e insights

1. Se derivan de métricas + reglas de negocio.
2. Estados de pasos/acciones se persisten vía endpoints de acciones.

## Puntos de extensión (dónde tocar según cambio)

### Nuevo tipo de reporte CSV

- Extender detección en `parsers/index.ts`.
- Crear parser especializado en `parsers/`.
- Conectar en `import-service.ts`.
- Verificar tablas/columnas objetivo en `db/supabase-adapter.ts`.

### Nueva métrica de negocio

- Implementar cálculo en `calculation-engine.ts` o `metrics-service.ts`.
- Exponer endpoint en `routes/api.ts`.
- Agregar tipos en `shared/` si también se usa en frontend.

### Nuevo filtro (ejemplo: segmentación adicional)

- Añadir parámetro en endpoint.
- Propagar en servicios de cálculo.
- Ajustar consultas en adapter si el filtro requiere pushdown a DB.

### Cambio de schema en datos

- Crear migración SQL en `backend/migrations/`.
- Actualizar adapter y tipos asociados.
- Revisar parsers y servicios impactados.

## Variables de entorno (backend)

- `PORT` (default `3001`).
- `SUPABASE_URL`.
- `SUPABASE_SERVICE_ROLE_KEY` (recomendado backend) o `SUPABASE_ANON_KEY`.
- `NODE_ENV` (`production` para servir frontend estático).

## Riesgos conocidos al modificar backend

- Cálculos centrales concentrados en archivos grandes (`calculation-engine.ts`, `metrics-service.ts`).
- Paginación manual en lectura masiva de Supabase (impacto performance en cuentas grandes).
- Caché global in-memory (invalidación no siempre granular).
- Fallback de períodos históricos puede ocultar ausencia de datos recientes si no se revisa flag.

## Checklist de cambio backend

- Definir contrato de entrada/salida (request + response).
- Alinear tipos en `shared/` cuando haya impacto cross-layer.
- Validar que no se rompa importación CSV existente.
- Ejecutar `npm run test --workspace=backend`.
- Ejecutar `npm run build --workspace=backend`.
- Smoke test manual de endpoint modificado.
- Si tocaste pacing histórico: validar migración + backfill + flag `isApproximate`.