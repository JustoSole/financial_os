# Testing

## Unit and integration tests

- **Frontend** (Vitest + React Testing Library): `npm run test --workspace=frontend`
- **Backend** (Vitest): `npm run test --workspace=backend`

Run all: `npm test` (from repo root).

## E2E scenarios (manual or future automation)

1. **Importar datos**: Datos > Cargar reportes > subir CSV > verificar que procesa sin errores.
2. **Cargar costos**: Datos > Cargar costos > completar montos > Guardar > verificar en Costos.
3. **Copiar mes anterior**: Datos > Cargar costos > Copiar mes anterior > verificar que se cargan.
4. **Cerrar mes**: Datos > checklist de cierre > Cerrar mes > verificar status y badge.
5. **Reabrir mes**: Datos > Reabrir > verificar que permite edición.
6. **Costos read-only**: Costos > verificar que muestra resumen > link "Editar en Datos" lleva a tab costos.
7. **Costos sin datos**: Costos > mes sin costos > empty state con CTA directo a Datos.
8. **Navegación**: Todas las pages cargan sin quedar en loading indefinido.
9. **Período cerrado**: Intentar guardar costos en período cerrado → error 409.

## Performance and acceptance

- Ninguna página debe quedar en loading indefinido.
- Backend usa caché in-memory para métricas frecuentes.
- `npm run build` y `npm test` deben pasar sin errores ni warnings de TypeScript.

## Snapshot backfill checklist

1. Ejecutar backfill: `npm run backfill:snapshots --workspace=backend -- <propertyId> [limit]`.
2. Verificar en `/api/metrics/:propertyId/projections`: `pacing.isApproximate` y `diagnostics`.
