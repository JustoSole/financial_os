# Backend Developer Reference

Referencia técnica del backend (`backend/`) para implementar cambios con rapidez y seguridad.

## Stack

- Node.js + TypeScript + Express.
- Supabase como capa de datos y autenticación.
- Vitest para tests.

Scripts clave:
- `npm run dev --workspace=backend`: desarrollo.
- `npm run build --workspace=backend`: compilación.
- `npm run test --workspace=backend`: tests.

## Estructura y responsabilidades

### `backend/src/routes/api.ts`
Router principal. Endpoints organizados por dominio:
- Salud e importación: `/health`, `/import/validate`, `/import`, `/import/batch`, `/import/jobs/:propertyId`.
- Propiedad: `/property`, `/property/:id`, `/property/:propertyId/reset`.
- Métricas: `/metrics/:propertyId/*` (command-center, cash, channels, structure, reconcile, trends, projections, reservation-economics, etc.).
- **Costos mensuales**: `/costs/:propertyId/categories`, `/costs/:propertyId/monthly/:month` (GET/PUT), `/costs/:propertyId/monthly/:month/copy-previous`.
- Acciones: `/actions/:propertyId/*`.
- Otros: `/data-health/:propertyId`, `/telemetry`.

> Todos los endpoints con `:month` validan formato `YYYY-MM` con `validateMonth()`.

### `backend/src/db/`
- `index.ts`: interfaz `DatabaseOperations` y selección de adaptador.
- `supabase-client.ts`: cliente Supabase (anon/service role).
- `supabase-adapter.ts`: operaciones de lectura/escritura. Incluye:
  - `upsertMonthlyCosts()`: upsert por (property, month, category, type).
  - `resetDatabase()`: limpia todas las tablas en orden de FK.

### `backend/src/parsers/`
- `csv-parser.ts`: parse CSV, normalización de números/encodings, column mappings.
- `transaction-parser.ts`: Expanded Transaction Report → tipo interno.
- `reservation-parser.ts`: Reservations with Financials → tipo interno.
- `index.ts`: detecta tipo de reporte, valida y delega parser.

### `backend/src/services/`
- `calculation-engine.ts`: núcleo de cálculos financieros con auto-detección de rango.
- `import-service.ts`: orquesta validación + parseo + persistencia.
- `metrics-service.ts`: métricas por dominio.
- `reservation-economics-service.ts`: P&L por reserva.
- `projections-service.ts`: proyecciones/pacing.
- `cache-service.ts`: caché in-memory con TTL.

## Flujo de datos end-to-end

### 1) Importación de CSV
1. Frontend sube archivo(s) a `/api/import/batch`.
2. `import-service` parsea CSV, detecta tipo, valida estructura.
3. Se transforma a tipos internos y se persiste en Supabase.
4. Se generan snapshots diarios para pacing histórico.
5. Se limpia caché para evitar lecturas obsoletas.

### 2) Guardar costos del mes
1. Frontend envía `PUT /api/costs/:propertyId/monthly/:month` con entries y cashBalance.
2. `upsertMonthlyCosts()` persiste entries, `upsertMonthlyCashBalance()` persiste saldo.
3. Se limpia caché.

## Variables de entorno

- `PORT` (default `3001`).
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` (opcional, bypasea RLS).
- `NODE_ENV` (`production` para servir frontend estático).

## Checklist de cambio backend

- [ ] Definir contrato de entrada/salida.
- [ ] Alinear tipos en `shared/`.
- [ ] Validar que no se rompa importación CSV.
- [ ] `npm run build` sin errores.
- [ ] Smoke test manual del endpoint modificado.
