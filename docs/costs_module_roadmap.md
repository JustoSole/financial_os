# Financial OS — Costos: diagnóstico brutal + roadmap (5 mejoras)

**Contexto**  
El módulo de Costos hoy es excelente para el objetivo MVS: *tener un piso financiero* (break-even / tarifa mínima) y alimentar insights de rentabilidad.  
Pero si lo dejamos como está, corre dos riesgos: **(a) inconsistencias que erosionan confianza** y **(b) límites estructurales** que impiden escalar a estrategias más finas (pricing por canal/LOS/temporada) o a un P&L más “real”.

Este documento propone **5 mejoras** (priorizadas) para que Costos no se quede corto.

---

## 0) Diagnóstico sin sugar coat (estado actual)

### Lo que está sólido
- **Fijos mensuales** + **variables mensuales** prorrateados por noche: suficiente para *piso financiero* y *unit economics*.
- **Comisiones por canal** configurables: base fuerte para distribución y pricing floor.
- **Impuestos v1** (`tax_rules`) con `includedInRate`: permite tratar impuestos incluidos como costo (enfoque RM).

### Lo que está flojo / peligroso
- **Riesgo #1 (grave): limpieza por estadía puede no estar entrando** cuando se usan categorías flexibles.
- **Riesgo #2: configuración “muerta”**: `extraordinary_costs` y `payment_fees` existen en UI/API, pero no están claramente aplicados en el engine → *falsa sensación de precisión*.
- **Riesgo #3: excesivo prorrateo mensual**: funciona para promedios, pero no para decisiones finas (LOS, lead time, DOW, promos) porque no modela costos dependientes de reserva.

---

## 1) Mejora #1 (P0) — Consistencia: limpieza por estadía SIEMPRE impacta

### Problema
Hoy, cuando el usuario usa `variable_categories`, el cálculo de `getVariableCostPerNight()` toma `cleaningPerStay = 0` (o sea: ignora limpieza por estadía en ese modo).

Impacto: el sistema puede **inflar margen**, bajar artificialmente break-even price y sugerir precios demasiado agresivos.

### Qué haría
- Convertir `cleaningPerStay` en un **campo de primera clase** del modelo (ya está en UI y en `variable_costs.cleaningPerStay`).
- En el engine, calcular limpieza por estadía **independiente** de si hay categorías o no:
  - `monthlyVariableTotal` sale de categorías o legacy.
  - `cleaningPerStay` sale de `variable_costs.cleaningPerStay` (siempre).

### Resultado para el usuario
El “piso” y la rentabilidad por reserva dejan de ser optimistas por error. Aumenta la confianza.

### Dónde toca
- `backend/src/services/costs-utils.ts` (cálculo variable/noche)
- Validación + messaging en UI `frontend/src/pages/Costs.tsx` (ya existe el input)

---

## 2) Mejora #2 (P0) — “Nada se guarda si no impacta”: extraordinarios y fees entran al P&L

### Problema
`extraordinary_costs` y `payment_fees` existen y se guardan, pero si no se aplican en cálculos, el sistema está vendiendo una precisión que no tiene.

### Qué haría
**2A) `payment_fees`** (costo variable % revenue)
- Aplicarlo como:
  - costo global: `paymentFeeRate * revenue` (si no hay método de pago)
  - opcional: si se puede inferir método desde transacciones en el futuro, usar `byMethod`.

**2B) `extraordinary_costs`** (costos “one-off”)
- Incluirlos en `netProfit` del período como “otros gastos” (no prorrateados por noche, o prorrateo transparente).
- Mostrar siempre como línea separada (“Extraordinarios”) para no confundir con operación normal.

### Resultado para el usuario
El net profit y el piso de pricing se acercan más a la realidad (especialmente en propiedades con alto fee de cobro o meses con shocks).

### Dónde toca
- `backend/src/services/calculation-engine.ts` (profitability y/o cost breakdown)
- `backend/src/services/metrics-service.ts` (simulador min price usa costos)
- UI: `Rentabilidad` y `Command Center` (mostrar línea “fees/extraordinarios”)

---

## 3) Mejora #3 (P1) — Modelo de costos “híbrido”: mensual + por reserva + % revenue (sin volverse contabilidad)

### Problema
Hoy casi todo se modela como “mensual / noches”. Eso tapa señales clave:
- reservas cortas (1 noche) suelen perder por *costos por estadía*,
- fees % revenue cambian la contribución,
- algunas variables dependen del huésped, del tipo de habitación o del check-in/out.

### Qué haría (MVS de granularidad)
Agregar 3 “modos” de costos variables (sin romper lo existente):
- **Mensual** (como hoy): lavandería, insumos, etc.
- **Por estadía**: limpieza, welcome kit, comisión fija de canal, etc.
- **% revenue**: payment fees, impuestos no incluidos (si se decide), promos/cupones.

Opcional (si hay energía): “por noche ocupada” directo.

### Resultado para el usuario
Rentabilidad por patrón (LOS) y por canal se vuelve *mucho más accionable* y evita “pricing recomendado” que falla en estadías cortas.

### Dónde toca
- Modelo `cost_settings` (json) + UI `Costs`
- `calculateReservationEconomics` (para aplicar costos por reserva)

---

## 4) Mejora #4 (P1) — Versionado / vigencia de costos (evitar comparaciones injustas)

### Problema
Costos cambian (inflación/temporada). Si el engine usa costos actuales para analizar reservas viejas, puede disparar falsos “no rentable”.
De hecho, el sistema ya se protege en acciones/insights con `disableFallback` para evitar inflación cruzada; falta que costos también tengan “as-of”.

### Qué haría
Permitir costos con **fecha de vigencia** (mínimo: por mes):
- “Desde YYYY-MM”: costos fijos/variables y tasas.
- El engine toma los costos que correspondan al período analizado.

### Resultado para el usuario
Comparativas y diagnósticos dejan de ser injustos y se sostiene la credibilidad con historia larga.

### Dónde toca
- `cost_settings` (historial o snapshot mensual)
- Engine: seleccionar costos por período

---

## 5) Mejora #5 (P2) — Data health de costos: validaciones y alertas que evitan basura

### Problema
Si costos/comisiones están en 0 o incompletos, el sistema puede “verse lindo” pero estar mintiendo sin querer.

### Qué haría (muy práctico)
Checklist automático (y visible) en Costos + Rentabilidad:
- room_count > 0
- fixed_monthly > 0
- cleaning_per_stay configurado si hay estadías cortas
- commissions configuradas si hay OTAs
- taxes: si están “incluidos”, exigir reglas o marcar “incompleto”
- payment fees: si enabled, exigir defaultRate

Y mostrar:
- “Tu piso tiene confianza: Alta/Media/Baja”
- “Te falta X para que la tarifa mínima sea real”

### Resultado para el usuario
Menos sorpresas, más adopción. También reduce soporte.

### Dónde toca
- `Costos` UI + `Data Health`/confidence logic (ya existe algo parecido)

---

## Resumen de prioridades (si tengo que elegir solo 2 cosas)

- **P0-1**: arreglar limpieza por estadía para que siempre compute.  
- **P0-2**: meter payment fees + extraordinarios al P&L (si se guardan, tienen que impactar).

Con esas dos, el módulo de costos deja de tener agujeros que pueden invalidar pricing.

---

## Nota final (criterio de producto)
El objetivo no debería ser “contabilidad perfecta”. El objetivo es:
**una base de costos suficientemente correcta y explicable** como para soportar:
- piso de pricing,
- decisiones por canal/LOS,
- y timing (Proyecciones) sin caer en números fake.








