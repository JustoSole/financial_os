# Testing

## Unit and integration tests

- **Frontend** (Vitest + React Testing Library): `npm run test --workspace=frontend`
  - `getCompletarDatosDestination`: Completar datos destination by issue type (costos vs import).
  - `EmptyState`: Renders title/description and internal vs external CTA (Link vs button).
- **Backend** (Vitest): `npm run test --workspace=backend`
  - `cache-service`: get/set/clear and TTL expiry.
  - `actions-service.getCompletedSteps`: `byActionId`, `actionStatus` (done/dismissed), and mixed step + whole-action completions.
  - `metrics-core`: prorrateo por overlap, ocupación cap a 100%, generación de snapshot diario.

Run all: `npm test` (from repo root).

## E2E scenarios (manual or future automation)

These flows should be covered by E2E (e.g. Playwright) when added:

1. **Usuario entra con datos incompletos** → CTA "Completar datos" lleva al destino correcto (/importar o /costos según el tipo de dato faltante).
2. **Importa datos** → Canales, Rentabilidad y Proyecciones cargan sin quedar en loading indefinido.
3. **Navega Ayuda / Glosario** → Enlaces externos en nueva pestaña; no pierde contexto de la app.
4. **Completa Costos por pasos** → Guardado exitoso y datos reflejados en la app.
5. **Marca una acción como hecha o descartada** → El estado persiste y se ve actualizado (filtros Pendientes / Hechas / Descartadas).

## Performance and acceptance

- Ninguna página crítica (Canales, Rentabilidad, Proyecciones) debe quedar en loading indefinido.
- Backend usa caché en command-center, reservation-economics, trends y projections para reducir recomputación.
- Lint/build/test sin regresiones: `npm run build` y `npm test` deben pasar.

## Snapshot backfill checklist

1. Aplicar migración `backend/migrations/create_reservation_daily_snapshots.sql`.
2. Ejecutar backfill: `npm run backfill:snapshots --workspace=backend -- <propertyId> [limit]`.
   - Dry run opcional: `npm run backfill:snapshots --workspace=backend -- <propertyId> [limit] --dry-run`.
   - Backfill de todas las propiedades: `npm run backfill:snapshots:all --workspace=backend -- [limit] --dry-run`.
   - Alternativa API protegida: `POST /api/admin/:propertyId/backfill-snapshots` con body `{ "limit": 5000, "dryRun": false }`.
3. Si falta snapshot as-of histórico, reconstruir fallback operativo:
   - `npm run reconstruct:snapshot:asof --workspace=backend -- <propertyId> <YYYY-MM-DD> [--dry-run]`.
   - `npm run reconstruct:snapshot:asof:all --workspace=backend -- <YYYY-MM-DD> [--dry-run]`.
4. Verificar en `/api/metrics/:propertyId/projections`:
   - `pacing.isApproximate` y `pacing.diagnostics`.
   - `importedWeeks + reconstructedWeeks + approximatedWeeks = totalWeeks`.
5. Revalidar comparación YoY en semanas con alta anticipación de reserva (debe acercar más a Cloudbeds).
