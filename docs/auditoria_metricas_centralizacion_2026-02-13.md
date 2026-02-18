# Auditoria Tecnica de Metricas y Centralizacion

Fecha: 2026-02-13  
Proyecto: `finacial_os_cloudbeds`  
Objetivo: detectar errores de calculo y falta de centralizacion en metricas financieras/operativas, y definir un plan de correccion.

---

## 1) Decisiones de negocio confirmadas

Estas decisiones quedan como reglas base para toda la implementacion:

1. **Ocupacion vs Cloudbeds**: se compara contra **inventario total** (no ajustado por OOO).  
2. **Pacing historico**: se requiere **snapshot historico exacto del PMS** (no aproximacion por `booking_date <= asOfDate`).  
3. **Contratos de porcentaje al frontend**: todas las metricas de porcentaje se exponen en escala **0-100**.

---

## 2) Resumen ejecutivo

El backend tiene una buena base en `CalculationEngine`, pero actualmente conviven varias implementaciones paralelas de metricas (ocupacion, noches, comparativas, proyecciones), con diferencias de formula y de filtro temporal. Esto genera:

- divergencias contra Cloudbeds,
- divergencias entre pantallas internas,
- y riesgo alto de regresiones al tocar una metrica en un solo modulo.

Se detectaron hallazgos de severidad alta, incluyendo un bug directo en `occupancyOTB` de Projections y calculos de MoM/YoY/DOW que no prorratean noches por periodo.

---

## 3) Alcance de la auditoria

Revision de backend y frontend en:

- `backend/src/services/`
- `backend/src/db/`
- `backend/src/parsers/`
- `backend/src/routes/`
- `frontend/src/pages/`
- `frontend/src/components/`
- `frontend/src/utils/`

Metricas auditadas:

- Occupancy, ADR, RevPAR, NRevPAR, GOPPAR
- room_nights y revenue por periodo
- OTB y pacing
- MoM / YoY / DOW
- break-even y unit economics
- comisiones e impuestos
- cash y reconciliacion

---

## 4) Hallazgos tecnicos (priorizados)

## 4.1 Severidad Alta

### A1) Bug en `occupancyOTB` (Projections)

**Archivo:** `backend/src/services/projections-service.ts`  
**Problema:** `occupancyOTB` usa `reservations[0]?.room_count || 10` en lugar de `cost_settings.room_count`.  
**Impacto:** porcentaje de ocupacion incorrecto en Projections.

---

### A2) MoM/YoY sin prorrateo real de noches

**Archivo:** `backend/src/services/metrics-service.ts`  
**Problema:** se filtra por solapamiento de periodo, pero luego se suma `room_nights` total de la reserva sin prorratear a los dias dentro del periodo.  
**Impacto:** ocupacion, ADR y comparativas distorsionadas en reservas que cruzan limites de fecha.

---

### A3) DOW sin prorrateo por dia real

**Archivo:** `backend/src/services/metrics-service.ts` (`calculateDOWPerformance`)  
**Problema:** usa `room_nights` raw agregado por `check_in`, sin distribuir noches reales por dia de semana.  
**Impacto:** performance por dia de la semana inconsistente.

---

### A4) `getOccupancyStats` con criterio temporal incorrecto

**Archivo:** `backend/src/db/supabase-adapter.ts`  
**Problema:** filtra por `check_in` dentro del rango, en lugar de overlap de estadia; no prorratea.  
**Impacto:** noches ocupadas no representan el periodo real.

---

### A5) Falta de centralizacion real (SSOT incompleto)

**Archivos:** `CalculationEngine`, `metrics-service`, `projections-service`, `supabase-adapter`, `command-center-service`  
**Problema:** varias formulas duplicadas con criterios distintos.  
**Impacto:** inconsistencias entre endpoints y pantallas, mantenimiento fragil.

---

## 4.2 Severidad Media

### M1) Pacing historico no usa snapshot exacto PMS

**Archivo:** `backend/src/services/projections-service.ts`  
**Problema:** aproximacion por `booking_date <= asOfDate`.  
**Impacto:** diferencia con expectativa de negocio (snapshot historico exacto Cloudbeds).

---

### M2) Inconsistencia de canales directos

**Archivos:** varios (`calculation-engine`, `metrics-service`, `actions-service`, frontend)  
**Problema:** listas de canales directos no unificadas (`directo` presente en unos lados y ausente en otros).  
**Impacto:** errores en comisiones, mix, recomendaciones y profit por canal.

---

### M3) Revenue/cash semanal por `check_in` (no prorrateado por semana)

**Archivos:** `metrics-service` (`calculateRevenueProjection`), `projections-service` (`calculateWeeklyCashFlow`)  
**Problema:** reserva multi-semana no se distribuye correctamente por semana.  
**Impacto:** lectura de flujo semanal potencialmente sesgada.

---

### M4) Frontend recalcula metricas derivadas

**Archivos:** `frontend/src/pages/Projections.tsx`, `ComparisonCard`, otros  
**Problema:** parte del % se recalcula en UI en lugar de venir cerrado del backend (ej. cobrado vs pendiente).  
**Impacto:** riesgo de divergencia, edge cases (division por cero), redondeo inconsistente.

---

## 4.3 Severidad Baja

### B1) Estandar de porcentajes ambiguo en frontend

**Archivo:** `frontend/src/utils/formatters.ts`  
**Problema:** mezcla de valores 0-1 y 0-100 sin contrato unico estricto.  
**Impacto:** riesgo de escalado incorrecto.

---

### B2) Redondeos heterogeneos

**Archivos:** varios backend/frontend  
**Problema:** distintas reglas de redondeo segun endpoint/componente.  
**Impacto:** diferencias visuales menores pero recurrentes.

---

## 5) Causas raiz

1. Crecimiento incremental de modulos sin cerrar una capa unica de metricas.  
2. Reuso parcial de `CalculationEngine` (base correcta, adopcion incompleta).  
3. Contrato API de porcentajes no formalizado en tipos compartidos.  
4. Falta de tests de consistencia cruzada entre endpoints.

---

## 6) Propuesta de cambios (arquitectura objetivo)

## 6.1 Crear capa central de metricas (SSOT real)

Implementar un modulo unico (por ejemplo `backend/src/services/metrics-core/`) con funciones puras:

- `getOverlappingNights(reservation, period)`
- `prorateReservationToPeriod(reservation, period)`
- `aggregatePeriodMetrics(reservations, period, roomCount, options)`
- `calculateOccupancyPercent(nights, roomCount, days)`  -> siempre 0-100
- `calculateAdr(revenue, nights)`
- `calculateRevpar(revenue, roomCount, days)`

Reglas de negocio embebidas:

- exclusiones de estado centralizadas (`Cancelled`, `No Show`),
- inventario total para ocupacion,
- redondeo estandar,
- timezone definida por propiedad (o UTC explicito mientras no exista field de timezone).

---

## 6.2 Migrar consumidores a la capa central

Refactor en este orden:

1. `projections-service` (`occupancyOTB`, pacing period metrics, weekly views)
2. `metrics-service` (MoM, YoY, DOW)
3. `supabase-adapter.getOccupancyStats` (o deprecarlo y delegar en services)
4. `command-center-service` (eliminar cualquier formula derivada duplicada)

---

## 6.3 Contrato unico de porcentajes (backend -> frontend)

Todos los porcentajes expuestos al frontend deben ser **0-100**:

- occupancy
- commission rates visuales
- shares
- conversiones de changePercent
- pacing deltas

Si existe una metrica en ratio (0-1) por necesidad interna, no debe salir asi por API publica.

---

## 6.4 Snapshot historico exacto para pacing

Reemplazar aproximacion por DBA por snapshot real:

- opcion A: almacenar snapshots diarios/periodicos por propiedad;
- opcion B: consulta directa a fuente historica confiable (si existe en la integracion).

Mientras no exista snapshot:

- marcar visualmente como "aproximado",
- no mezclarlo con comparativas exactas.

---

## 7) Plan de implementacion (fases)

## Fase 1 - Hotfixes criticos (1-2 dias)

1. Corregir `occupancyOTB` para usar `roomCount` real.  
2. Unificar exclusion de estados en helper comun.  
3. Evitar division por cero en frontend para `% cobrado`.

## Fase 2 - Centralizacion funcional (3-5 dias)

1. Crear `metrics-core` y mover formulas base.  
2. Refactor MoM/YoY/DOW para usar prorrateo central.  
3. Refactor Projections para consumir el mismo core.  
4. Estandarizar porcentajes 0-100 en responses.

## Fase 3 - Endurecimiento y trazabilidad (3-5 dias)

1. Implementar snapshot historico exacto de pacing.  
2. Agregar tests de consistencia cruzada.  
3. Documentar formulas en `BACKEND_DEV_REFERENCE.md`.

---

## 8) Criterios de aceptacion

Se considera resuelto cuando:

1. **Mismo dataset, misma formula** -> occupancy/ADR/RevPAR consistentes entre Home, Projections, Command Center, MoM, YoY y DOW.  
2. No existe calculo manual de ocupacion fuera de `metrics-core`/`CalculationEngine` centralizado.  
3. Todos los `%` entregados a frontend estan en escala 0-100.  
4. Pacing historico usa snapshot exacto o queda explicitamente etiquetado como aproximado si aun no esta implementado.  
5. Tests verdes en escenarios de reservas que cruzan periodos y semanas.

---

## 9) Plan de pruebas recomendado

Casos minimos obligatorios:

1. Reserva que inicia antes del periodo y termina dentro.  
2. Reserva que inicia dentro y termina despues.  
3. Reserva que cubre todo el periodo.  
4. Mezcla de estados (`Confirmed`, `Cancelled`, `No Show`).  
5. room_count bajo (1-3) y alto (100+) para validar denominadores.  
6. Semanas con reservas multi-semana para cash/revenue semanal.  
7. Comparacion MoM/YoY con datasets sinteticos controlados.

Validaciones:

- occupancy no supera 100%,
- `RevPAR = Revenue / (roomCount * days)`,
- coherencia entre endpoints para mismo periodo,
- frontend no aplica multiplicadores extra de porcentaje.

---

## 10) Riesgos y mitigaciones

Riesgos:

- cambios de formula pueden mover numeros historicos visibles al usuario,
- dependencia de datos historicos para snapshot exacto,
- refactor transversal en varios endpoints.

Mitigaciones:

- feature flag por endpoint para migracion gradual,
- tests de regresion por modulo,
- comparador temporal (old vs new) en entorno staging.

---

## 11) Checklist para el programador

- [ ] Fix de `occupancyOTB` en Projections.  
- [ ] Crear `metrics-core` con formulas y filtros unificados.  
- [ ] Refactor MoM/YoY/DOW a `metrics-core`.  
- [ ] Refactor `getOccupancyStats` a overlap + prorrateo o deprecacion.  
- [ ] Unificar lista de canales directos en constante compartida.  
- [ ] Estandarizar respuestas de porcentaje a 0-100.  
- [ ] Eliminar calculos duplicados de porcentajes en frontend.  
- [ ] Agregar tests unitarios + integracion de consistencia cruzada.  
- [ ] Documentar formulas finales.

---

## 12) Estado final de la auditoria

Resultado: **inconsistencia alta, solucion abordable en fases cortas**.  
Prioridad inmediata: corregir bug de `occupancyOTB` y centralizar calculos de noches/ocupacion para cortar divergencias con Cloudbeds.

---

## 13) Estado de implementación (actualizado)

Implementado en código:

- [x] Fix `occupancyOTB` en Projections con `roomCount` real.
- [x] Capa `metrics-core` creada y usada por Projections/MoM/YoY/DOW/occupancy stats.
- [x] Refactor MoM/YoY/DOW a prorrateo por overlap real.
- [x] `getOccupancyStats` corregido a overlap + prorrateo.
- [x] Canales directos unificados con helper común (`isDirectChannel`).
- [x] `%` de cobrado en Projections sale del backend (`collectedPercent`) y no se recalcula en frontend.
- [x] Tests unitarios mínimos de SSOT agregados (`metrics-core`).
- [x] Snapshot histórico de pacing implementado con tabla `reservation_daily_snapshots`.
- [x] Backfill idempotente para snapshots por propiedad (`npm run backfill:snapshots --workspace=backend -- <propertyId> [limit]`).

Pendiente sugerido (endurecimiento):

- [ ] Agregar tests de consistencia cruzada multi-endpoint (mismo período, misma métrica, mismo resultado).
- [x] Incorporar validación operativa de `isApproximate` + `pacing.diagnostics` en smoke de Projections.
- [x] Completar hardening de snapshot con:
  - `snapshot_source` (`imported`/`reconstructed`),
  - reconstrucción as-of por CLI/API,
  - trazabilidad de cobertura (`importedWeeks`, `reconstructedWeeks`, `approximatedWeeks`).