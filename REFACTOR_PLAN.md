# Financial OS — Review crítico (vista por vista) + “Profit-first” + Impuestos (v1)

> Objetivo del documento: mejorar **retención + disposición a pagar** haciendo la app más “profit-first”, más confiable y más accionable (cierre mensual + fugas), usando lo que ya construiste.

---

## TL;DR (sin sugar coat)

- **UI/UX**: se ve premium y ordenado. Tenés “forma de producto” real.
- **Riesgo #1**: confianza. Hay inconsistencias que un hotelero detecta al toque (ej: filtro “Últimos 30 días” vs acciones de 500+ días; ocupación 100% vs 86%; costos en 0 → márgenes “mágicos”).
- **Wedge real para cobrar**: no es “cash/runway”. Es **Profit + cierre mensual + leak detection**.
- **Inflación**: no la uses para “comparar compset” todavía. Usala como **modo de unidad de cuenta** (USD / index) + tendencias internas.
- **Falta impuestos**: sí, y te conviene incorporarlos como **capa simple y auditable**, porque afectan neto, comisiones efectivas y reconciliación.

---

## Norte de producto: “Profit Management” (no solo Revenue)

La industria viene empujando pasar de métricas de revenue (RevPAR) a métricas de **profit** y net revenue, como **GOPPAR** y **NRevPAR**, porque reflejan mejor el impacto de costos y distribución.  
- GOPPAR = GOP / habitaciones disponibles. :contentReference[oaicite:0]{index=0}  
- NRevPAR = (Room revenue – distribution costs) / habitaciones disponibles. :contentReference[oaicite:1]{index=1}  
- HSMAI viene discutiendo explícitamente la necesidad de nuevas métricas (más allá de RevPAR) para reflejar el RM moderno. :contentReference[oaicite:2]{index=2}

**Traducción para tu app:** “Profit clarity” gana. “Más dashboards” pierde.

---

# 1) Inicio / Panel de Control

## Qué está bien
- Jerarquía visual sólida: KPI grande + módulos accionables (cobranza, canales, análisis profundo).
- Tenés señales correctas de hotel (OCC/ADR/Revenue + Profit).

## Qué está mal / peligroso
1) **Moneda/escala inconsistente** (M/K/puntos) → baja confianza.
2) **Proyección vs cierre** no está claro (30 días vs mes calendario).
3) Falta **Data Confidence visible** en el header (última actualización, cobertura, faltantes).

## Cambios “alto ROI”
- **Header fijo**: `Moneda` + `Última actualización (hace X)` + `Cobertura (92%)` + `Faltan: pagos / impuestos / costos`.
- Reemplazar “Estado actual” por CTA: **“Cerrar mes”** (ver sección “Cierre mensual v1”).
- Unificar formato numérico: siempre `ARS 41,8M` / `USD 41.8k` (sin mezclar).

---

# 2) Acciones

## Qué está bien
- Convertir insights en tareas es clave para salir de “BI pasivo”.

## Lo que rompe (grave)
- Filtro “Últimos 30 días” mostrando items de **500+ días** → esto mata credibilidad.
- “Urgentes = 0” cuando hay ítems viejos y con montos grandes → motor de prioridad mal calibrado.
- Acciones sin “next best step” auditable (qué evidencia mirar, dónde conciliar).

## Cambios “alto ROI”
- **Score de urgencia**: `Impacto ($) × días vencido × probabilidad`.
- Agrupar por “buckets”:  
  - “Cobros pendientes Booking.com (10) — ARS X”  
  - “Comisiones anómalas (3) — ARS Y”  
- Cada acción debe tener: **Impacto**, **Evidencia**, **Link al detalle**, **Botón resolver**.

---

# 3) Canales / Rentabilidad por Canal

## Qué está bien
- “Te está costando 18% real” es excelente framing.
- Tabla por canal con noches/ingresos/comisión/te queda es útil.

## Lo que falta / mejora
- Estás mostrando “Distribución de revenue”; para profit-first, el gráfico principal debería ser **share de profit (o neto)**.
- Long tail de canales con 1–2 reservas ensucia. Nadie decide sobre 2 noches.

## Cambios “alto ROI”
- Donut principal: **Profit share por canal** (o Net share si no tenés impuestos completos).
- Top 5 canales + “Otros”.
- Módulo: **“Impacto de mover 10pp a Directo”** (simulación simple).

> Importante: NRevPAR y la deducción de costos de distribución refuerzan tu narrativa de “costo real por canal”. :contentReference[oaicite:3]{index=3}

---

# 4) Rentabilidad por Reserva (P&L + Simulador)

## Qué está bien
- Gran potencial de wedge: “reservas que pierden plata” es ultra tangible.
- Simulador de precio mínimo es útil para dueños sin RM.

## Bandera roja
- “Con pérdida: 0 (0%)” es **increíble** (en el mal sentido). Si todo da perfecto, el usuario sospecha.
- Si costos variables están en 0, todo parece rentable.

## Cambios “alto ROI”
- Si costos variables = 0 → banner rojo: “Tus márgenes están inflados: faltan costos”.
- Mostrar siempre “Top 10 peores márgenes” aunque sean positivos (para mejorar).
- Conectar simulador → acción (ej: “subir mínimo ADR canal X” / “bloquear 1-night stays fechas Y”).

---

# 5) Tendencias MoM / YoY

## Qué está bien
- MoM/YoY es lo que entienden y piden.

## Qué está mal / inconsistencia
- Ocupación 100% vs 86% en distintas vistas → hay error de definición o denominador.
- Falta contexto de muestra: “días cubiertos”, “reservas incluidas”.

## Cambios “alto ROI”
- Etiqueta fija: “Datos incluidos: 28/30 días — 130 reservas”.
- Auditoría de definiciones: OCC/ADR/RevPAR deben ser consistentes (los hoteleros detectan incoherencias rápido).

---

# 6) Costos / Configuración de costos

## Qué está bien
- UX muy buena para un tema feo.
- Limpieza por estadía es un acierto (costo por checkout).

## Lo flojo
- Sigue siendo mucho input manual → si no lo completan, todo el resto queda “bonito pero falso”.
- Comisiones por canal: larga y fácil de quedar mal.

## Cambios “alto ROI”
- Wizard de 7 minutos:
  1) costos fijos (sueldos, servicios, alquiler)
  2) limpieza por estadía
  3) 3 variables principales (lavandería/amenities/insumos) con defaults
  4) comisiones: plantillas por OTA, el user ajusta excepciones
- Validación: “si no cargaste X, tus márgenes están subestimados/sobreestimados”.

---

# 7) Impuestos (nuevo módulo v1) — diseño simple y robusto

Los impuestos en hotelería suelen ser:
- **VAT/IVA** sobre alojamiento (depende país/reglas).
- **Impuesto/tasa de alojamiento** (occupancy / lodging tax) que suele ser % del room rate y/o tasa fija local. :contentReference[oaicite:4]{index=4}
- **City / tourist tax** (a veces fijo por persona/noche y se muestra separado en factura). :contentReference[oaicite:5]{index=5}

## Objetivo del módulo v1
No hacer contabilidad fiscal. Hacer:
1) que el **neto real** sea más correcto,
2) que el canal/accionable sea más realista,
3) que el cierre mensual tenga “cosas que faltan” explícitas.

## Data model mínimo
- `tax_rules`:
  - `tax_type` = {VAT, OCCUPANCY, CITY_TAX, OTHER}
  - `applies_to` = {room_rate, fees, penalty, total}
  - `calc_method` = {percentage, fixed_per_night, fixed_per_person_night, fixed_per_stay}
  - `rate` / `amount`
  - `included_in_rate` (bool) — si el precio que ve el huésped incluye tax o se suma
  - `channel_exemptions` (opcional)
  - `guest_exemptions` (opcional: residentes/no residentes, etc.)
- `reservation_tax_breakdown` (calculado):
  - `reservation_id`
  - `tax_type`
  - `tax_amount`
  - `confidence` (exacto/estimado)

## UX mínimo (dónde aparece)
1) **Costos**: bloque “Impuestos y tasas” (wizard simple).
2) **Rentabilidad por canal**: mostrar “Neto después de comisiones e impuestos”.
3) **Rentabilidad por reserva**: breakdown en “memoria de cálculo”.
4) **Acciones**: “Faltan reglas de impuestos → márgenes inflados”.

## Regla de oro de producto
- Si no se configuró, mostrás **Estimado** y lo decís explícito (no lo escondas).

---

# 8) “Profit visibility” — cómo subirlo sin rehacer todo

## Cambios de layout (rápidos)
- KPI principal del dashboard: **Profit neto** + “por qué cambió” (3 drivers).
- En Canales: **Profit share** arriba; revenue abajo.
- En Rentabilidad por reserva: default tab “Peores márgenes” (no “todas”).

## Nuevos KPIs “profit-first”
- GOPPAR y/o Proxy GOPPAR si no tenés todo (mientras tanto). :contentReference[oaicite:6]{index=6}
- NRevPAR (si tenés costos de distribución). :contentReference[oaicite:7]{index=7}
- “Comisión efectiva” = comisiones / revenue canal (ya lo insinuás; hay que elevarlo).

---

# 9) Cierre Mensual v1 (lo que te aumenta retención y willingness-to-pay)

## Qué es
Una pantalla / flow que siempre produce:
- 1 resumen (1 página)
- 5 checks de confianza
- 5 acciones prioritarias con impacto estimado

## Checklist (mínimo)
1) **Cobranza**: ¿qué falta cobrar? ¿qué está vencido?
2) **Comisiones**: ¿comisión efectiva cambió fuerte vs mes anterior?
3) **Costos**: ¿faltan categorías? ¿costos variables en 0?
4) **Impuestos**: ¿reglas configuradas? ¿estimadas?
5) **Sanity check**: OCC/ADR/Revenue dentro de rangos esperados (y consistentes entre vistas)

## Output
- Profit neto (con confidence)
- Drivers: canal mix, ADR, costos variables, comisiones, impuestos
- “Top leaks” (3–5)
- “Top actions” (3–5)

---

# 10) Prioridades (próximas 2 semanas)

1) Corregir inconsistencias duras: [COMPLETADO]
   - filtro temporal en Acciones (corregido en actions-service.ts)
   - ocupación inconsistente entre vistas (unificado en CalculationEngine.ts)
   - bandera roja si costos variables = 0 (implementado en Profitability.tsx)
2) Header de confianza + cobertura [COMPLETADO] (ConfidenceHeader.tsx implementado globalmente)
3) Profit share en Canales + Top 5 + simulación [COMPLETADO] (Channels.tsx actualizado)
4) Impuestos v1 (simple) + "estimado" si falta [COMPLETADO] (Data model extendido + UI en Costs.tsx)
5) Pantalla "Cierre mensual v1" como entry point [COMPLETADO] (MonthlyClosing.tsx + CTA en Home)

---

## Criterio de éxito (producto, no vanity metrics)

- Activación: >30% llegan a “primer profit confiable” en 1 sesión.
- Retención: >50% vuelven al menos 1 vez/mes (cierre).
- Conversión: si el cierre mensual ahorra tiempo + reduce fugas, se vende solo.