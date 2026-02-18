# Implementation Change Playbook

Guía práctica para implementar cambios en este proyecto minimizando riesgo técnico y regresiones funcionales.

## Objetivo

- Estandarizar cómo se diseña, implementa y valida cada cambio.
- Asegurar consistencia entre backend, frontend y tipos compartidos.
- Dejar trazabilidad útil para equipos humanos y LLMs.

## Tipos de cambio y rutas recomendadas

## Cambio solo de UI (sin nuevo dato backend)

Tocar principalmente:

- `frontend/src/pages/*`
- `frontend/src/components/*`
- `frontend/src/components/ui/*`

Validación mínima:

- tests frontend + build frontend + smoke visual.

## Cambio de endpoint o payload

Tocar principalmente:

- `backend/src/routes/api.ts`
- `backend/src/services/*`
- `frontend/src/api.ts`
- `shared/src/types/*` (si cambia contrato)

Validación mínima:

- tests backend/frontend + build monorepo + prueba manual end-to-end del flujo.

## Cambio en ingesta CSV o modelo de datos

Tocar principalmente:

- `backend/src/parsers/*`
- `backend/src/services/import-service.ts`
- `backend/src/db/supabase-adapter.ts`
- `backend/migrations/*` (si hay cambio de schema)

Validación mínima:

- importación de archivos reales/sintéticos + verificación de métricas derivadas.

## Cambio operativo / backfill de datos derivados

Tocar principalmente:

- `backend/src/services/*` (servicio de backfill reutilizable)
- `backend/src/scripts/*` (ejecución CLI)
- `backend/src/routes/api.ts` (endpoint admin protegido, opcional)
- `docs/TESTING.md` y `docs/DEVELOPER_REFERENCE_BACKEND.md`

Validación mínima:

- dry-run sin escritura + ejecución real en entorno de prueba.
- verificar que el endpoint/CLI es idempotente.
- smoke test del flujo consumidor (ej. projections con `isApproximate`).

Notas operativas para snapshots de pacing:

- Priorizar `backfill` de snapshots importados.
- Si falta as-of histórico, ejecutar reconstrucción controlada (`reconstruct:snapshot:asof`) y marcar fuente.
- En validación final, exigir diagnóstico de cobertura (`pacing.diagnostics`) en vez de validar solo un booleano.

## Proceso estándar (7 pasos)

1. Definir el alcance exacto del cambio (qué problema resuelve y qué no).
2. Localizar capa principal afectada (UI, API, cálculo, parser, DB).
3. Verificar contrato de datos (tipos de request/response y `shared/`).
4. Implementar cambio en la capa principal.
5. Propagar ajustes en capas dependientes.
6. Ejecutar validaciones técnicas (test/build/smoke).
7. Documentar decisiones y riesgos remanentes.

## Regla de oro de contratos

Si cambia estructura de datos que cruza backend y frontend, actualizar primero tipos compartidos en `shared/` y luego adaptar consumidores.

## Smoke tests recomendados por dominio

### Importación

- Validar archivo con `/api/import/validate`.
- Ejecutar importación de un CSV válido.
- Confirmar que se registró en historial.

### Métricas

- Consultar `command-center` para una propiedad con datos.
- Confirmar que no hay errores de parseo/NaN en respuesta.
- Consultar `projections` y verificar:
  - `isApproximate` coherente con cobertura.
  - `importedWeeks + reconstructedWeeks + approximatedWeeks = totalWeeks`.

### Costos

- Leer costos actuales.
- Editar y guardar costos.
- Verificar reflejo en vistas dependientes.

### Acciones

- Cargar acciones pendientes.
- Marcar paso/acción como completada o descartada.
- Confirmar persistencia y refresco de UI.

## Criterios de aceptación mínimos (Definition of Done)

- Build completo pasa: `npm run build`.
- Tests relevantes pasan: `npm test` o por workspace.
- No hay errores de runtime en flujo principal afectado.
- Documentación actualizada si cambió arquitectura/contrato.

## Plantilla de changelog técnico interno

Usar esta plantilla al cerrar una tarea:

- Cambio implementado:
- Capa(s) impactada(s):
- Contratos/tipos modificados:
- Riesgos detectados:
- Validación ejecutada:
- Próximo paso recomendado:

## Guía para usar con LLMs (context packs)

## Pack mínimo para cualquier tarea

- `docs/README_DEVELOPERS.md`
- `docs/IMPLEMENTATION_CHANGE_PLAYBOOK.md`

## Pack para tareas backend

- `docs/DEVELOPER_REFERENCE_BACKEND.md`
- `docs/TESTING.md`
- Documento de dominio (por ejemplo costos/roomtype).

## Pack para tareas frontend

- `docs/DEVELOPER_REFERENCE_FRONTEND.md`
- `docs/TESTING.md`
- Documento de dominio correspondiente.

## Pack para cambios de datos o cálculos

- `docs/DEVELOPER_REFERENCE_BACKEND.md`
- `docs/costs_module_roadmap.md` (si aplica costos)
- `docs/auditoria_metricas_centralizacion_2026-02-13.md`

## Errores frecuentes a evitar

- Implementar endpoint sin actualizar cliente `frontend/src/api.ts`.
- Cambiar payload sin alinear tipos compartidos.
- Introducir lógica de negocio en componentes de UI.
- Omitir smoke test de importación cuando se toca parser/DB.
- Duplicar lógica entre script y endpoint en vez de extraer servicio común.
- Mezclar snapshots importados y reconstruidos sin exponerlo en API/UI (opacidad operativa).