# Financial OS (Cloudbeds-first) — PRD v2.0 (Command Center Edition)

> Objetivo: construir un **micro-SaaS PLG** que responda las **40 preguntas clave** que un dueño de hotel necesita saber, con **mínima fricción** y sin convertir la venta en consultoría.

---

## 0) Decisiones de producto (no negociables)

1. **Solo 3 fuentes para el MVS** (cloudbeds exports):

* **Expanded Transaction Report with Details** (ledger / caja real)
* **Reservations with Financials** (unidad económica = reserva)
* **Channel Performance Summary** (mix por canal)

2. **Etiqueta de confianza obligatoria** en cada número: `Real / Estimado / Incompleto` + Nivel de Confianza (●/◐/○).

3. **"Explain this number"** (ver cálculo) en cada métrica clave para cortar soporte y evitar venta consultiva.

4. **Automatización del input sin API**: "Inbox Connect" vía **Subscriptions** de Cloudbeds, que permite auto-email programado y export con vistas **Table / Details Only** en **CSV/JSON**.

5. **No prometer comisión real por canal** en Cloudbeds: cuando no exista en reportes, usar **estimación editable** (con sello "Estimado").

---

## 1) Usuario objetivo (ICP) y Jobs-to-be-done

### ICP

* Dueños/operadores de **hoteles chicos y medianos** (ARG/LATAM primero).
* Usan Cloudbeds como PMS. No técnicos. Poco tiempo. Odian exports/manualidad.

### JTBD primarios (las 40 preguntas)

El producto debe responder estas preguntas organizadas en "loops de decisión":

#### Salud del negocio en 60 segundos (Q1-5)
1. ¿Estoy ganando o perdiendo dinero en el período?
2. ¿Cómo están Occupancy, ADR y RevPAR?
3. ¿Mi rentabilidad está sana (GOPPAR)?
4. ¿Qué cambió vs el período anterior?
5. ¿Qué me debería preocupar HOY?

#### Break-even y punto de equilibrio (Q6-12)
6. ¿Cuál es mi punto de equilibrio en ocupación?
7. ¿Cuántas noches necesito vender para cubrir fijos?
8. ¿Cuál es mi tarifa mínima (break-even price)?
9. Si apunto a X% margen, ¿cuál es la tarifa mínima?
10. ¿Qué tan lejos estoy del equilibrio hoy?
11. ¿Qué pasa si suben costos variables?
12. ¿Empeorando por precio (ADR) o por ocupación?

#### Unit economics por noche (Q13-17)
13. ¿Cuánto gano por noche ocupada?
14. ¿Cuál es mi margen de contribución por noche?
15. ¿Cuánto me cuesta operar cada noche (CPOR)?
16. ¿Qué parte del costo es fijo vs variable?
17. ¿Qué variable de costo se disparó?

#### Distribución y canales (Q18-24)
18. ¿Cuál es mi mix de canales por revenue y noches?
19. ¿Cuál es mi costo de distribución por canal?
20. ¿Cuál es el ingreso neto por canal?
21. ¿Cuál canal aporta más profit por noche?
22. ¿Estoy sobre-dependiente de OTAs?
23. ¿Cuánto pago en comisión promedio efectiva?
24. ¿Qué canal "se ve bien" en revenue pero es malo en margen?

#### Caja y cobranzas (Q25-29)
25. ¿Cuánto cobré vs cuánto cargué?
26. ¿Cuánta plata tengo pendiente y de qué reservas?
27. ¿Qué parte del pending está vencida vs futura?
28. ¿Mi caja aguanta X días?
29. ¿Qué eventos me rompen caja?

#### Pace y pickup (Q30-33)
30. ¿Cómo viene el pace del mes vs anterior?
31. ¿Cuánto pick-up tuve en los últimos 7 días?
32. ¿Qué fechas están flojas y cuáles fuertes?
33. ¿Mi ADR on-the-books sube o baja?

#### Calidad de datos (Q34-37)
34. ¿Tengo data suficiente para confiar?
35. ¿Qué falta para HIGH confidence?
36. ¿Qué parte es real vs estimada?
37. ¿Qué reportes faltan importar?

#### Acciones (Q38-40)
38. ¿Cuál es la 1 acción con más impacto esta semana?
39. ¿Qué canal empujar para mejorar margen?
40. ¿Qué ajuste de margen es realista?

---

## 2) Benchmark competitivo (cómo ser "superior")

Soluciones enterprise como ProfitSword (Actabl) se enfocan en BI + forecasting/budgeting.
Tu superioridad no es "más features"; es:

* **Time-to-Value < 5 min**
* **40 preguntas respondidas sin jerga**
* **cero implementación**
* **trust layer** (Real vs Estimado) + explicación simple

---

## 3) Data Sources (CSV) — definición exacta y columnas reales

### A) Expanded Transaction Report with Details (CSV)

**Rol:** Fuente de verdad para caja/cobros/ledger (Real).
**Columnas reales:**

* `Transaction Date Time - Property`
* `Reservation Number`
* `Reservation Source`
* `Transaction Type`
* `Debits`
* `Credits`
* `Transaction Amount`
* `Void Flag`, `Refund Flag`, `Adjustment Flag`
* `Transaction Description`, `Transaction Notes`, `Transaction Source`
* (opcionales de método): `Card Type`, `Card Last 4 Digits`

**Normalización mínima:**

* `direction`: `credit` si `Credits > 0`, `debit` si `Debits > 0`
* `amount`: `abs(Credits - Debits)`
* Excluir filas `Void Flag = true`

---

### B) Reservations with Financials (CSV)

**Rol:** Unidad económica por reserva (Real para revenue por reserva; Estimado para margen).
**Columnas reales:**

* `Reservation Number`
* `Reservation Status`
* `Reservation Source Category`, `Reservation Source`
* `Check-In Date`, `Check-Out Date`
* `Room Nights`
* `Room Revenue Total`
* `Total Reservation Taxes`
* `Reservation Paid Amount`
* `Reservation Balance Due`
* `Suggested Deposit`
* `Hotel Collect Booking Flag`
* (ignorar en MVS): datos personales (nombre, email, teléfono)

**Regla clave:** la UI no muestra PII en el MVS.

---

### C) Channel Performance Summary (CSV)

**Rol:** Mix por canal (Real) + "costo estimado" (Estimado).
**Columnas reales:**

* `Reservation Source Category`
* `Reservation Source`
* `Room Nights - sum`
* `Room Revenue Total - sum`
* `Estimated Commission - sum` (a menudo 0)

---

## 4) Estructura de Pricing PLG (4 niveles)

### Filosofía de Pricing

La clave de pricing para PLG exitoso no es "features infinitas", sino **valores claramente diferenciados** que el usuario pueda ver y sentir en minutos.

Un dueño de hotel siempre se pregunta:
1. *¿Esto me dice algo que no puedo ver en Cloudbeds en 1 clic?*
2. *¿Esto me ayuda a ganar/mantener dinero?*
3. *¿Esto es más útil que una hoja de cálculo?*
4. *¿Vale lo que cuesta?*

---

### 🆓 Plan Free — Scanner Básico

**Objetivo:** activación rápida, valor instantáneo, tráfico PLG.

**Incluye:**
* Subida manual de CSVs (1 por tipo de reporte / 30 días)
* **Command Center** con métricas básicas:
  * Net Profit del período
  * KPIs: Occupancy, ADR, RevPAR, GOPPAR
  * Break-even básico
  * Channel mix
* Hasta 2 acciones recomendadas
* **Sin historial** (solo datos del último import)
* Data Health Score y explicación
* Botón CTA para automatizar (Inbox Connect)

**Restricciones:**
* Historial: Solo período actual (30 días máximo)
* Imports: 1 por tipo de reporte
* Acciones: Máximo 2
* Propiedades: 1

**Copy:** "Probalo ahora y entendé tus datos en 5 min"

---

### 💼 Plan Paid — Financial OS Essentials

**Objetivo:** primera monetización con lo esencial que un dueño realmente usa para operar.

**Incluye todo de Free, más:**
* Imports ilimitados
* **Históricos extendidos (≥ 12 meses)**
* 5 insights accionables
* Rentabilidad por reserva (P&L operativo detallado)
* Patrones de pérdida (ej. estadías de 1 noche no rentables)
* **Command Center completo**:
  * Simulador de margen (10%, 20%, 30%)
  * A/R Aging detallado
  * Channel profit per night
* Comparativos por periodo (MoM, YoY básico)
* Forecast básico de caja (30/60/90 días)

**Restricciones:**
* Historial: 365 días
* Acciones: Hasta 5
* Propiedades: 1
* Sin Inbox Connect
* Sin alertas automáticas

**Precio sugerido:** $29–49 USD/mes

---

### 🚀 Plan Pro — Financial OS + Auto Sync + Analytics

**Objetivo:** clientes que quieren automatización, reporting recurrente, alertas y mayor profundidad.

**Incluye TODO de Paid, más:**
* **Inbox Connect (auto-email ingestion)**
* **Alertas configurables:**
  * "Si runway < 30 días"
  * "Si AR pendiente > X"
  * "Si refunds inusuales"
* Comparativos avanzados (YTD / MOM / YOY automáticos)
* Exportes PDF/Excel diseñados para dueños y contadores
* Todas las acciones disponibles
* Prioridad en soporte
* API key (si el plan de Cloudbeds lo permite)

**Precio sugerido:** $79–129 USD/mes

---

### 🤝 Plan Partner — Multi-propiedad / Enterprise

**Objetivo:** gestores de 5+ propiedades, consultores, operadores.

**Incluye TODO de Pro, más:**
* Dashboard multi-propiedad consolidado
* Benchmark por portfolio
* Alertas centralizadas
* White label reports
* Soporte VIP
* Multi-usuario

**Precio sugerido:** $199–399 USD/mes

---

## 5) Trust Layer y Data Health (diferencial anti-consultoría)

### 5.1 Taxonomía de confianza (por métrica)

* **REAL:** proviene directo de ledger (Debits/Credits) o campos "Paid/Balance Due".
* **ESTIMADO:** comisiones por canal, costos operativos, margen, runway proyectado, profit neto, GOPPAR, break-even.
* **INCOMPLETO:** faltan reportes o faltan columnas clave.

### 5.2 Data Health Score (0–100)

**Base:** 100

Penalizaciones:

* Falta Expanded Transactions: −40
* Falta Reservations with Financials: −30
* Falta Channel Performance Summary: −20
* Último import > 7 días: −10
* **Cobertura histórica insuficiente (< 3 meses):** Indica que las comparativas MoM/YoY serán limitadas o nulas.

### 5.3 Banners de Confianza (Command Center)

*   **Data Confidence Banner:** Nivel de confianza (HIGH/MEDIUM/LOW) y qué falta para llegar a HIGH.
*   **History Warning Banner:** Alerta si solo hay 1 mes de datos, sugiriendo cargar historia para desbloquear comparativas.

---

## 6) Modelo de costos (mínimo viable, sin contabilidad)

**Pantalla Costos** debe pedir *solo* lo que desbloquea cálculos sin fricción:

* `room_count` (1 campo): cantidad de habitaciones
* `starting_cash_balance` (1 campo)
* `variable_costs`:
  * `cleaningPerStay`: limpieza por estadía
  * `laundryMonthly`: lavandería mensual
  * `amenitiesMonthly`: amenities mensual
* `fixed_costs`:
  * `salaries`: sueldos
  * `rent`: alquiler
  * `utilities`: servicios
  * `other`: otros
* `channel_commissions`:
  * `defaultRate`: tasa default OTA
  * `byChannel`: overrides por canal

**Copy obligatorio:**

* "Estos costos se usan para **estimaciones operativas**, no reemplazan contabilidad."

---

## 7) UX / Vistas — especificación actualizada

### `/` Home — Command Center (v2.0)

**Secciones (orden):**

1.  **Banners:** Confidence y History Coverage.
2.  **Weekly Action Card** — La única acción más importante de la semana.
3.  **Sección 1: Salud del negocio en 60 segundos** (Net Profit, KPIs Big 4).
4.  **Sección 2: Comparativas (MoM / YoY)** — Análisis vs período anterior y año pasado.
5.  **Sección 3: Tendencias** — Evolución visual de los últimos 6 meses.
6.  **Sección 4: Punto de Equilibrio** (Gauge + Simulador dinámico).
7.  **Sección 5: Unit Economics** (Profit por noche, Cost Mix).
8.  **Sección 6: Canales** (Ranking de profit, OTA dependency).
9.  **Sección 7: Caja y Cobranzas** (Reconciliación, Aging).
10. **Quick Actions** — Links rápidos a páginas de detalle.

**No mostrar:** tablas largas por defecto en Home.

---

### `/acciones`

* Lista de acciones con filtros (Cash / Cobranza / Canales / Datos).
* Cada acción tiene: Impacto, Confianza y "Ver evidencia".
* **Si Free:** Mostrar acciones bloqueadas con CTA upgrade.

---

### `/canales`

* Donut + 2 cards: "Dependencia OTA" y "Ahorro potencial estimado".
* Tabla Top 8 canales con **profit per night** y comisión editable inline.
* Best/Worst channel highlight.
* CTA: "Optimizar mix".

---

### `/caja`

* Runway card (con sello "Estimado").
* Tendencia cobrado vs cargado (últimos 30/90).
* **A/R Aging visual** (vencido, próximo 7, próximo 30, futuro).
* Reconciliación con gap explicado.
* Alertas: refunds/voids/ajustes fuera de patrón (Real).
* **Histórico largo:** Solo Paid+ (CTA upgrade si Free).

---

### `/rentabilidad`

*   **Pestañas de análisis:** Peores, Mejores, Patrones, Umbrales, Simulador, Todas.
*   **Reservation Drawer:** El "Explain this number" definitivo con desglose P&L y memoria de cálculo detallada.

---

### `/costos`

* Room count (crítico para cálculos).
* **Categorías Flexibles (V4):** Fijos y variables totalmente personalizables.
* Preview instantáneo: "Con estos costos, tu break-even es X%".
* Copy de disclaimer.

---

### `/importar`

*   **Soporte Multiversión:** Permite cargar archivos de hasta 3 años de antigüedad.
*   **Feedback en tiempo real:** Validación de columnas y reportType antes de importar.
*   **Import batch:** Soporte para subir múltiples CSVs simultáneamente.

---

### `/configuracion`

* Propiedad: nombre, moneda, timezone
* **Plan actual con comparador de planes**
* Inbox Connect (Pro badge si no disponible)
* Exportar datos / borrar cuenta

---

## 8) API Endpoints

### Import

* `POST /api/import/validate` (detecta reportType + columnas + warnings)
* `POST /api/import` (procesa y guarda)
* `POST /api/import/batch` (múltiples archivos)
* `GET /api/import/history/:propertyId`

### Command Center (Nuevo - Unificado)

* `GET /api/metrics/:propertyId/command-center?days=30`
  * Retorna: health, breakeven, unitEconomics, channels, cash, dataConfidence, weeklyAction

### Metrics (Legacy + Extended)

* `GET /api/metrics/:propertyId?days=30` — Dashboard básico
* `GET /api/metrics/:propertyId/cash?days=90` — Runway y flujo
* `GET /api/metrics/:propertyId/channels?days=90` — Mix con profit per night
* `GET /api/metrics/:propertyId/collections?days=30` — Cobranzas
* `GET /api/metrics/:propertyId/structure?days=30` — Occupancy, ADR, RevPAR, GOPPAR
* `GET /api/metrics/:propertyId/breakeven?days=30` — Break-even analysis
* `GET /api/metrics/:propertyId/minimum-price?margin=X` — Tarifa para margen objetivo
* `GET /api/metrics/:propertyId/ar-aging` — Aging de A/R
* `GET /api/metrics/:propertyId/reconcile?days=30` — Cargado vs Cobrado
* `GET /api/metrics/:propertyId/projection?weeks=4` — Proyección futura
* `GET /api/metrics/:propertyId/comparison` — MoM comparison
* `GET /api/metrics/:propertyId/insights?days=30` — Insights generados

### Reservation Economics

* `GET /api/metrics/:propertyId/reservation-economics?days=30` — Summary
* `GET /api/metrics/:propertyId/reservation-economics/list` — Lista filtrable
* `GET /api/metrics/:propertyId/reservation-economics/:resNumber` — Detalle P&L

### Actions

* `GET /api/actions/:propertyId?days=30&limit=N` (limit por plan)
* `POST /api/actions/:propertyId/step` (checklist)

### Costs

* `GET /api/costs/:propertyId` — Configuración con calculated values
* `GET /api/costs/:propertyId/channels` — Canales detectados en PMS
* `PUT /api/costs/:propertyId` — Actualizar

### Data Health

* `GET /api/data-health/:propertyId` — Score y issues

---

## 9) Telemetría (PLG + monetización)

### Activación
* `import_started / import_success / import_failed`
* `view_home / view_channels / view_cash / view_costs / view_profitability`
* `command_center_loaded`
* `time_to_first_value` (TTFV < 10 min target)

### Engagement
* `action_clicked / action_step_completed`
* `weekly_action_clicked`
* `breakeven_simulation_used`
* `weekly_return_rate`

### Monetización
* `upgrade_cta_clicked`
* `upgrade_completed`
* `plan_type` en cada evento
* `churn_risk_signal`

---

## 10) Métricas de éxito PLG

### Activación
* % usuarios free que completan import inicial: **target 60%+**
* Time-to-first-value (TTFV): **target < 10 min**
* % que ven Command Center completo: **target 80%+**

### Retención
* % que vuelve semanalmente: **target 40%+**
* Churn mensual: **target < 5%**

### Monetización
* % Free → Paid: **target 8-12%**
* % Paid → Pro: **target 25%**
* CAC payback: **target < 3 meses**
* ARPU por segmento

---

## 11) Roadmap

### v2.0 (Completado)
*   ✅ Command Center con análisis MoM/YoY.
*   ✅ Gráficos de tendencia (last 6 months).
*   ✅ Date Range Picker con rangos personalizados.
*   ✅ P&L Detallado por reserva con Memoria de Cálculo.
*   ✅ Detección de cobertura histórica insuficiente.

### v2.1 (Próximo)
*   Inbox Connect (auto-ingesta por email).
*   Alertas configurables por email/whatsapp.
*   Exportes PDF automatizados.

### v3.0 (Futuro)
*   Integración directa con API Cloudbeds.
*   Forecasting con ML básico.
*   Multi-propiedad para Partner.
