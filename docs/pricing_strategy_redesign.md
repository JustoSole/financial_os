# Financial OS — Rediseño “Estrategia de Pricing” (sin tabs) + Ajustes en Proyecciones

**Objetivo**  
Hacer que el usuario pueda construir una **estrategia de pricing clara, directa y accionable** para **margen y rentabilidad**, usando **solo datos existentes** en el sistema (costos, comisiones, patrones de pérdida, lead time, DOW, pacing/OTB/gaps), sin agregar complejidad tipo “RM engine”.

**Principio rector**  
Pasar de “muchas tabs analíticas” a una única experiencia:  
**guardrails (piso) + reglas (estrategia) + timing (cuándo actuar)**.

---

## 1) Rentabilidad: 1 sola tab (larga) — “Estrategia de Pricing”

### 1.1 Estructura propuesta (una sola pantalla)

La pantalla se divide en 6 secciones verticales. Cada sección tiene:
- un **insight** (qué pasa),
- una **decisión** (qué regla aplico),
- una **acción** (qué cambio hago hoy),
- **evidencia** (datos que lo justifican).

**Sección 0 — Header (contexto y ancla mental)**
- Título: **Estrategia de Pricing**
- Subtítulo: “Definí tu piso, tus reglas y el plan de esta semana”
- Selector de período (si aplica) + estado de confianza (ya existe “trust layer”).
- Un CTA pequeño: “Ver Radar (Proyecciones)” (link a `/proyecciones`).

---

### 1.2 Sección 1 — “Piso Financiero” (guardrail no negociable)

**Qué muestra (ya existe):**
- **Tarifa de Equilibrio (breakEvenPrice)**: “por debajo perdés seguro”.
- **Tarifa mínima objetivo** con slider de **margen deseado** (minPrice).
- Desglose: **Fijos + Variables + Comisión → Equilibrio → + Margen**.

**Cómo hacerlo más entendible (copy):**
- “Tu piso HOY (con tus costos y tu mix de canales)”
- “Si tu ADR está por debajo: estás comprando ocupación con pérdida.”

**Acciones embebidas (sin integraciones PMS):**
- Botón: “Revisar costos/comisiones” → `/costos`
- Botón: “Ver pérdida por patrón” → scroll a Sección 3

**Datos usados (existentes):**
- `breakEvenPrice`, `minPrice`, `avgCommissionRate`
- costos fijos y variables (capacidad), comisiones promedio

---

### 1.3 Sección 2 — “Estrategia en 5 Reglas” (lo que el usuario *define*)

Acá el producto deja de ser “analytics” y se vuelve “estrategia”.  
Cada regla tiene: **toggle + número editable + explicación + evidencia**.

#### Regla 1 — Piso global (siempre ON)
- **Definición:** “Mi tarifa mínima objetivo es **minPrice(margen)**”.
- **Input:** margen (%) y/o override manual de tarifa mínima.
- **Evidencia:** desglose del piso y comisión promedio.

#### Regla 2 — Markup por canal (OTAs vs Directo)
- **Definición:** “En OTAs con alto costo real, aplico markup de X%”.
- **Inputs:**
  - “Canales objetivo” (auto-sugerido: peores canales por `profitPerNight` o `effectiveCommissionRate`)
  - “Markup %” (default sugerido)
- **Evidencia:**
  - `effectiveCommissionRate`, `adrNet`, `profitPerNight`, `directAdr` (referencia)
- **Salida accionable:**
  - “Booking: +12%” / “Expedia: +10%” (ejemplo)

#### Regla 3 — LOS (1 noche / 2 noches / 3+)
- **Definición:** “Si 1 noche pierde plata, aplico recargo 1n o min-stay”.
- **Inputs:**
  - Toggle “Min stay 2 noches en fines de semana” (si aplica)
  - Toggle “Recargo por 1 noche” (markup 1n)
- **Evidencia:**
  - `patterns` (canal + nightsBucket) con `isLossPattern` y `lossAmount`
- **Salida accionable:**
  - “1 noche en OTA X pierde → recargo 1n + min stay vie/sáb”

#### Regla 4 — Lead time (anticipación)
- **Definición:** “Último minuto ≠ early booking: ajusto por ventanas”.
- **Inputs:**
  - buckets: 0–3, 4–7, 8–14, 15–30, 31+ días (ya existen)
  - markups/discounts por bucket (simple: 2–3 opciones, no 5 si querés simplificar)
- **Evidencia:**
  - `leadTimeAnalysis.globalLeadTimeProfitability` (ganancia/noche por bucket)
  - opcional: por canal (`byChannel`)
- **Salida accionable:**
  - “0–3 días: +8%” / “31+ días: -5%” (ejemplo)

#### Regla 5 — DOW / fin de semana
- **Definición:** “Mis días fuertes vs flojos tienen distinta regla.”
- **Inputs:**
  - “Recargo fin de semana” / “Flex entre semana”
  - opcional: min stay solo vie/sáb
- **Evidencia:**
  - DOW performance (ya existe endpoint / cálculo)
- **Salida accionable:**
  - “Vie/Sáb: +10% o min stay 2” / “Dom–Jue: precio base”

> Nota: estas reglas **no requieren** pronosticar demanda con ML. Son reglas operativas, basadas en rentabilidad real + señales de pacing.

---

### 1.4 Sección 3 — “Qué te está rompiendo el margen” (insights → reglas)

En vez de tabs “Peores/Mejores/Patrones”, se muestra un bloque único:

- **Top 3 fugas** (siempre 3, no 30):
  1) “Patrón de pérdida más grande” (pattern con mayor `lossAmount`)
  2) “Canal con peor profit/noche” (worstChannel)
  3) “Reserva tipo” (ejemplos: 1–2 reservas “worst”)

Cada fuga tiene:
- Qué pasa (1 línea)
- Qué regla la corrige (link a Regla 2/3/4)
- Impacto mensual estimado (simple: basado en pérdida histórica o nights × profit gap)

**Datos usados (existentes):**
- `patterns` (por canal + bucket)
- `channels.insights.worstChannel`, `profitPerNight`
- `worstReservations` (solo 1–2, no lista)

---

### 1.5 Sección 4 — “Plan de esta semana” (timing) — puente con Proyecciones

Esta sección toma el espíritu de `Proyecciones` (gaps/pacing) y lo traduce a “hoy hago X”.

**Componentes:**
- Estado: “Vas **ahead/behind/on track**” (pacing overallTrend).
- Lista de 3 tarjetas (máximo):
  - “Semana con gap más severo” (de `gaps`)
  - “Semana con mejor oportunidad (ahead)” (si existe)
  - “Pickup bajo/alto” (últimos 7 días)

**Cada tarjeta dice:**
- “Qué está pasando” (ocupación actual vs histórico y delta)
- “Qué palanca usar” según `actionType`:
  - `price_adjustment` → ajustar precio (pero **nunca bajo el piso**)
  - `minimum_stay` → activar Regla LOS
  - `promotion` → aplicar promo (reflejado como descuento controlado)
  - `visibility_boost` → priorizar directo / inventario / canal (acción operativa)
- CTA: “Aplicar regla sugerida” (scroll a regla correspondiente)
- CTA: “Ver en Radar” (link con anchor a semana en Proyecciones)

**Datos usados (existentes):**
- `ProjectionsData.gaps[]` + `pacing.periods[]` + `pickupLast7Days`

---

### 1.6 Sección 5 — “Detalle bajo demanda” (sin tabs, sin ruido)

En vez de tabs, un acordeón al final:
- “Ver tabla completa de patrones” (expand)
- “Ver mejores/peores reservas” (expand)
- “Ver distribución por canal (resumen)” (expand, o link a `/canales`)

Así mantenés potencia para power-users **sin contaminar** la UX principal.

---

## 2) Cómo “aprovechar más” los datos actuales (sin inventar nada)

### 2.1 Datos que ya existen y deben convertirse en “palancas”

**Cost-based (guardrails)**
- Break-even price (capacidad, costos fijos+variables, comisión promedio)
- Min price con margen (slider)

**Canal**
- Commission rate efectiva por canal
- ADR neto por canal y profit/noche por canal
- “Worst channel” vs “direct reference”

**LOS / patterns**
- `patterns` por canal + nightsBucket (1/2/3+)
- pérdida total por patrón y profit/noche promedio

**Lead time**
- mediana de lead time por canal
- buckets globales + profit/noche por bucket

**DOW**
- performance por día de semana (profit/noche y ocupación)

**Timing (Proyecciones)**
- OTB revenue / occupancy
- pacing YoY (DBA)
- gaps con actionType (price/min stay/promo/visibilidad)
- pickup 7 días

### 2.2 “Motor de decisión” (simple y explicable)

En cada recomendación, el sistema debe explicar:
- “**Por qué**”: evidencia (patrón/canal/gap)
- “**Qué regla**”: de las 5 reglas
- “**Qué acción**”: markup, min stay, promo controlada, ajuste de precio
- “**Qué límite**”: nunca cruzar el piso (Regla 1)

Esto genera confianza sin prometer magia.

---

## 3) Proyecciones: cambios propuestos (para que sea más accionable)

La pantalla de Proyecciones está bien. No hay que moverla; hay que **conectarla**.

### 3.1 Cambios en “Gaps” (cards)

Hoy cada gap tiene un botón genérico. Propuesta:
- El botón debe navegar con intención:
  - `price_adjustment` → `/rentabilidad#plan-semana` y focus en “ajuste de precio con piso”
  - `minimum_stay` → `/rentabilidad#regla-los`
  - `promotion` → `/rentabilidad#regla-leadtime` o bloque “promo controlada”
  - `visibility_boost` → `/canales` o `/acciones` según corresponda

Y agregar 2 líneas útiles:
- **“Recomendación concreta”** (ejemplo): “Abrí demanda: -5% (sin bajar de $X)”
- **“Impacto estimado”**: en noches o $ (simple, explicable)

### 3.2 Calendario diario

Agregar un overlay simple (no otro gráfico):
- “Días bajo piso” (si ADR estimado/actual < piso)
- “Días con gap” (badge)

Esto hace que el usuario vea “dónde duele” en el tiempo.

### 3.3 Pacing YoY (semanal)

Agregar un micro-copy:
- “Si estás **ahead**: podés subir sin matar ocupación.”
- “Si estás **behind**: priorizá palancas *sin* cruzar piso: promo, lead time, min stay.”

---

## 4) Qué se elimina / absorbe del diseño actual de Rentabilidad

**Eliminar tabs como navegación primaria:**
- “Powers”, “Mejores”, “Peores”, “Patrones” (se absorben en Sección 3 y Sección 5)

**Mantener la potencia:**
- Los datos siguen existiendo, pero quedan como:
  - “Top 3 fugas” (acción)
  - “Ver detalle” (acordeón)

Esto reduce carga cognitiva y aumenta uso real.

---

## 5) Checklist de calidad (para que sea “relevante, bueno y potente”)

- El usuario puede responder en 60 segundos:
  - “¿Cuál es mi piso?”
  - “¿Qué reglas estoy aplicando?”
  - “¿Qué hago esta semana y por qué?”
- Cada recomendación tiene:
  - evidencia (dato),
  - regla (decisión),
  - acción (operación),
  - límite (piso).
- Nunca aparece una lista larga sin síntesis.

---

## 6) Notas de implementación (sin código, solo enfoque)

Para llevarlo a producción sin riesgo:
- Reusar el simulador existente (piso+margen).
- Reusar `patterns`, `channels`, `leadTimeAnalysis`, `DOW`, `Projections.gaps`.
- Empezar con reglas “default sugeridas” y permitir override.
- Mantener el detalle bajo demanda para no perder potencia.


