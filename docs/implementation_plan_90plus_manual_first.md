# Financial OS - Implementation Plan v2 (Manual-First, No Sobrecomplejizar)

Fecha: 2026-02-15  
Objetivo: subir utilidad de producto a 90+ con foco en adopcion semanal, sin integracion write-back al PMS ni complejidad innecesaria.

---

## 1) Principios rectores

1. **Accion sobre analitica**: cada insight debe terminar en una accion concreta.
2. **Simple y explicable**: no caja negra, no modelos complejos en fase inicial.
3. **Manual-first**: el hotelero ejecuta en PMS; el sistema guia y mide resultado.
4. **Guardrails duros**: nunca recomendar por debajo de piso financiero.
5. **Reutilizar lo existente**: extender servicios actuales, evitar arquitectura nueva.
6. **No sobrecomplicar**: pocas pantallas, pocas reglas, alto impacto.

---

## 2) Alcance (In / Out)

## In scope (ahora)

- Plan semanal de decision (riesgo + top acciones + seguimiento).
- Forecast simple por escenarios (base/conservador/optimista).
- Net Parity accionable por canal.
- Rate Change List exportable (manual execution).
- Tracking de acciones aplicadas y resultado 7/14/30 dias.

## Out of scope (ahora)

- Push automatico al PMS (write-back).
- RMS avanzado / ML complejo.
- Configuracion extensa de reglas.
- Nuevas paginas o redisenos grandes.

---

## 3) Resultado de producto esperado

El hotelero puede responder en menos de 2 minutos:

1. **Como vengo** (riesgo proxima ventana).
2. **Que hago esta semana** (top 3 acciones con impacto).
3. **Si funciono** (resultado de acciones previas).

---

## 4) Lo minimo que falta (y nada mas)

Para llegar a 90+ sin sobrecargar:

1. **Decision Plan Semanal**: bloque visible en Home/Rentabilidad.
2. **Rate Change List**: salida operable para aplicar manualmente en PMS.
3. **Action Tracking**: marcar aplicado y medir resultado real.
4. **Forecast con confianza**: escenarios simples + nivel alta/media/baja.

Si estas 4 piezas estan bien hechas, el sistema cambia de "dashboard" a "copiloto operativo".

---

## 5) Arquitectura objetivo (sobre lo ya construido)

## Backend (extender, no reinventar)

- `backend/src/services/projections-service.ts`
  - mantener OTB/pacing actual.
  - agregar escenarios simples y confidence.

- `backend/src/services/calculation-engine.ts`
  - net parity por canal.
  - generacion de recomendaciones de precio con guardrails.

- `backend/src/services/command-center-service.ts`
  - top 3 acciones semanales para Home.

- `backend/src/routes/api.ts`
  - endpoints para:
    - weekly decision plan,
    - rate change list,
    - registrar accion aplicada,
    - consultar resultados.

- `backend/src/db/supabase-adapter.ts`
  - persistencia de acciones y resultados.

## Frontend (evolucion incremental)

- `frontend/src/pages/Home.tsx`
  - agregar "Plan de esta semana".

- `frontend/src/pages/Profitability.tsx`
  - agregar seccion de reglas + rate change list.

- `frontend/src/pages/Projections.tsx`
  - CTA accionable por gap.
  - escenarios y confidence visibles.

- `frontend/src/pages/Channels.tsx`
  - bloque compacto de net parity.

- `frontend/src/components/strategy/*`
  - componentes puntuales para plan/rate list/log.

---

## 6) Data model minimo (solo lo necesario)

Crear una sola tabla nueva en primera instancia:

### `pricing_actions`

Campos sugeridos:

- `id`
- `property_id`
- `action_type` (`net_parity`, `los`, `dow`, `promo`, etc.)
- `status` (`suggested`, `applied`, `dismissed`)
- `data` (jsonb con recomendacion + contexto + guardrails + impacto esperado)
- `applied_at`
- `created_at`

Nota: resultados 7/14/30 dias pueden guardarse dentro de `data` en v1.  
Evitar tabla adicional al inicio para mantener simplicidad.

---

## 7) Plan por fases (6 semanas)

## Fase 0 (Semana 1) - Baseline y telemetria minima

Objetivo: arrancar con medicion y sin deuda invisible.

Entregables:

- Eventos: `weekly_plan_viewed`, `rate_change_list_generated`, `action_marked_applied`.
- Baseline de precision forecast actual (7/14/30 dias).
- Checklist de data quality para habilitar recomendaciones.

Definition of Done:

- build/test verde.
- eventos visibles en logs o tabla de telemetria.

---

## Fase 1 (Semanas 2-3) - Decision Plan + Forecast simple (version reforzada)

Objetivo: convertir Proyecciones en una vista de decision semanal clara en menos de 60 segundos, sin agregar complejidad de RM avanzado.

### Resultado esperado de la fase

Al abrir Proyecciones, el usuario debe ver:

1. estado de riesgo (ahead / on_track / behind),
2. forecast de ocupacion/revenue por escenario (base, conservador, optimista),
3. top 1-3 acciones sugeridas con motivo y confianza.

### No objetivos de la fase (para evitar scope creep)

- no modelado de elasticidad compleja,
- no write-back al PMS,
- no configuracion avanzada de reglas.

### Entregables funcionales

1. **Escenarios simples y estables**
   - `base`: OTB + pickup esperado.
   - `conservador`: base ajustado por banda inferior.
   - `optimista`: base ajustado por banda superior.
   - horizonte recomendado: 21 dias (principal) y 60/90 dias como contexto.

2. **Confidence score operativo**
   - `alta`: buena cobertura historica + baja volatilidad reciente.
   - `media`: cobertura parcial o volatilidad media.
   - `baja`: cobertura insuficiente o alta inestabilidad.
   - si confidence baja, la UI debe decir "hipotesis" y no "recomendacion".

3. **Gaps -> accion concreta**
   - cada gap mapea a una accion primaria:
     - `price_adjustment`,
     - `minimum_stay`,
     - `promotion_controlled`,
     - `visibility_boost`.
   - cada accion incluye CTA directo a `Rentabilidad` con ancla.

4. **Decision panel (UI minima)**
   - bloque superior "Plan de esta semana":
     - Riesgo actual
     - Top 3 acciones
     - Confidence
   - mantener el resto de la pagina sin rediseno mayor.

### Logica minima sugerida (explicable)

1. `forecast_base = OTB_confirmado + pickup_esperado`
2. `pickup_esperado` estimado desde ritmo reciente y semana comparable.
3. bandas:
   - conservador: `forecast_base * (1 - banda)`
   - optimista: `forecast_base * (1 + banda)`
4. ajuste por eventos/feriados:
   - factor simple por `impact_level` (si existe evento cargado).
5. confidence:
   - ponderar cobertura historica, volatilidad y completitud de costos/comisiones.

Nota: mantener todo en reglas deterministicas; nada de caja negra en Fase 1.

### Contrato de datos minimo (API)

Extender respuesta de Proyecciones con:

- `decisionPlan.riskStatus`
- `decisionPlan.scenarios` (base/conservador/optimista)
- `decisionPlan.confidence` (alta/media/baja + reason[])
- `decisionPlan.topActions[]` (max 3 con `why`, `what`, `where`, `impactExpected`, `guardrail`)

### Archivos objetivo

- backend:
  - `backend/src/services/projections-service.ts`
  - `backend/src/routes/api.ts`
  - `shared/src/types/metrics.ts`
- frontend:
  - `frontend/src/pages/Projections.tsx`
  - `frontend/src/components/CalendarProjection.tsx` (solo ajustes visuales minimos)
  - `frontend/src/components/strategy/WeeklyPlanSection.tsx` (nuevo, simple)

### Instrumentacion minima de fase

- evento `weekly_plan_viewed`
- evento `top_action_clicked`
- evento `go_to_profitability_from_gap`

Objetivo de adopcion temprana:

- >=50% de sesiones de Proyecciones ven el decision panel.
- >=25% hacen click en al menos una accion sugerida.

### Definition of Done (reforzada)

- usuario entiende riesgo y accion sugerida en <60 segundos.
- no hay loading indefinido en Proyecciones.
- top acciones siempre incluyen guardrail y confidence.
- cuando confidence es baja, el copy cambia a "hipotesis".
- sin regresion en build/test/smoke de Proyecciones.

### Hallazgos reales de auditoria en `/proyecciones` (15-Feb-2026)

Estado observado en tab real:

1. La vista muestra pacing con advertencia:
   - snapshot requerido `2025-02-15`,
   - cobertura exacta `0%` (`0/13 semanas`),
   - snapshot disponible no alineado (solo fecha reciente).
2. Existen multiples cards de gaps "Baja ocupacion detectada", pero el CTA es generico (`Ver sugerencias`) y no ejecuta flujo accionable.
3. La pagina prioriza metricas OTB/pacing, pero no expone un bloque unico de decision semanal (riesgo + acciones + confianza).
4. Horizonte por defecto en 90 dias; para operacion semanal esto diluye señal de corto plazo.

Implicaciones para Fase 1:

- no alcanza con agregar escenarios; hay que hacer **orquestacion de decision** y **routing accionable**.
- con cobertura exacta baja, el sistema debe degradar recomendacion a "hipotesis" y evitar tono de certeza.

### Ajustes obligatorios de Fase 1 (derivados de la auditoria)

1. **CTA de gaps obligatorio y funcional**
   - mapear `actionType` a destino concreto:
     - `price_adjustment` -> `/rentabilidad#regla-precio`
     - `minimum_stay` -> `/rentabilidad#regla-los`
     - `promotion_controlled` -> `/rentabilidad#regla-promo`
     - `visibility_boost` -> `/canales#oportunidades`
   - eliminar boton generico sin destino.

2. **Policy de confianza estricta**
   - si `pacing.isApproximate=true` y cobertura exacta <50%:
     - badge "confianza baja",
     - texto "hipotesis operativa",
     - limitar top actions a acciones conservadoras (sin recomendaciones agresivas de precio).

3. **Priorizar horizonte operativo**
   - decision panel calcula riesgo primario a 21 dias.
   - 60/90 dias quedan como contexto secundario.

4. **Decision panel antes de todo**
   - mover "Plan de esta semana" al inicio de la pagina.
   - mostrar solo 1-3 acciones priorizadas por impacto y confianza.

5. **Telemetria de efectividad de CTA**
   - medir click-through real de cada tipo de accion para validar si la fase genera ejecucion.

---

### Estándar visual Fase 1 (Top-tier UX, obligatorio)

Objetivo visual:

- que la vista se sienta premium, clara y accionable en 1 lectura.
- eliminar sensación de "mucho dato suelto" y priorizar narrativa visual.

#### 1) Jerarquia visual recomendada (de arriba hacia abajo)

1. **Hero de Decision Semanal** (full width, primer bloque)
   - estado principal: `Ahead / On track / Behind`.
   - impacto esperado de la semana en moneda (rango).
   - confidence visible (badge + motivo corto).

2. **Escenarios (3 cards comparables)**
   - Base / Conservador / Optimista.
   - ocupacion + revenue + delta vs pacing.
   - mismo formato y escala para comparación rápida.

3. **Top 3 Acciones**
   - card de accion con:
     - titulo accionable ("Subir Booking +8%"),
     - por que (1 línea),
     - impacto esperado,
     - guardrail,
     - CTA primario.

4. **Radar de contexto**
   - calendario + pacing chart + cashflow (como hoy), pero con menor peso visual.

Regla:

**Nada debe competir visualmente con "que hacer esta semana".**

#### 2) Sistema de gráficos recomendado (sin sobrecargar)

Mantener máximo 3 tipos de visual:

1. **Sparkline de riesgo semanal** (hero)
   - comunica tendencia rápida.
2. **Comparador de escenarios (bar/mini-cards)**
   - evita chart complejo para escenarios.
3. **Pacing line chart** (ya existente)
   - mantener, pero con anotaciones de semanas críticas.

Evitar:

- más de 1 gráfico "denso" por viewport,
- colores ambiguos o sin significado semántico.

#### 3) Semántica visual y color (consistente)

- `success` = oportunidad controlada.
- `warning` = riesgo manejable.
- `error` = riesgo crítico.
- `info` = contexto.

Nunca usar color solo; acompañar con:

- icono + label textual,
- valor numérico principal.

#### 4) Microcopy premium (claridad de negocio)

Cada bloque debe responder en lenguaje de hotelero:

- "Qué está pasando"
- "Qué hacer ahora"
- "Cuál es el límite"

Formato recomendado de copy en cards:

- **Diagnóstico**: "Venís 12 pts abajo del ritmo."
- **Acción**: "Subí tarifa OTA 6-8% en semana X."
- **Límite**: "No bajar de $Y (piso)."

Evitar jerga técnica en primera línea (DBA, unconstrained, etc.).  
Si se usa, dejarlo en tooltip/ayuda secundaria.

#### 5) Interacción y navegación (flujo sin fricción)

- cada CTA debe llevar a destino con contexto (anchor + parámetros).
- destacar un solo CTA primario por card.
- incluir estado de acción:
  - sugerida,
  - aplicada,
  - descartada.

#### 6) Criterios de calidad visual (Definition of Quality)

Fase 1 no se considera terminada si no cumple:

1. Un usuario nuevo identifica "qué hacer esta semana" en <10 segundos.
2. El primer scroll contiene Hero + Escenarios + al menos 1 acción.
3. No hay más de 2 niveles de jerarquía en una misma card.
4. Todas las cards críticas tienen estado visual + impacto + guardrail.
5. En mobile, acciones y CTA siguen siendo visibles sin colapsar legibilidad.

#### 7) Componentes UI a crear/reusar

- Nuevo: `WeeklyDecisionHero`
- Nuevo: `ScenarioComparisonCards`
- Nuevo: `TopActionsPanel`
- Reusar: `Card`, `Badge`, `ProgressBar`, `PacingChart`, `CalendarProjection`

Nota de implementación:

- priorizar composición de componentes existentes,
- no introducir librerías nuevas de gráficos para Fase 1.

---

## Fase 2 (Semanas 4-5) - Rate Change List + Net Parity

Objetivo: output operable manual-first.

Entregables:

1. Net parity por canal en Canales.
2. Rate change list en Rentabilidad:
   - fecha, canal, precio actual -> sugerido, guardrail, impacto.
3. Acciones:
   - copiar,
   - exportar CSV,
   - marcar aplicado en PMS.

Definition of Done:

- generar lista de cambios en <2 minutos.
- ninguna recomendacion viola piso financiero.

---

## Fase 3 (Semana 6) - Loop cerrado de impacto

Objetivo: demostrar valor real y aprender.

Entregables:

1. Guardar acciones aplicadas en `pricing_actions`.
2. Mostrar resultado observado a 7/14/30 dias:
   - cambio en pickup, ADR, ocupacion, net revenue (segun accion).
3. Seccion "Resultados recientes" en Home o Rentabilidad.

Definition of Done:

- al menos 1 accion aplicada muestra delta observado.

---

## 8) Guardrails funcionales (obligatorios)

Toda recomendacion debe incluir:

- `why` (evidencia principal)
- `what` (accion concreta)
- `where` (canal + fechas)
- `impact_expected`
- `confidence`
- `guardrail` (piso/parity)

Regla dura:

**Si la data no alcanza, mostrar "hipotesis" en vez de "recomendacion".**

---

## 9) KPIs de exito

Producto:

- Tiempo para generar lista de cambios: <2 minutos.
- % usuarios activos semanales que usan plan semanal: >50%.
- `action_marked_applied / rate_change_list_generated`: >30%.

Negocio:

- mejora en net revenue y/o margen en cohortes activas.
- reduccion de semanas "behind pace".

Calidad:

- error de forecast 14 dias mejora >= 15% vs baseline.
- 0 recomendaciones bajo piso financiero.

---

## 10) Riesgos y mitigaciones (realistas)

1. **Baja adopcion por ejecucion manual**  
   Mitigacion: UX ultra simple (copy/csv/checklist) + seguimiento visible.

2. **Sobrepromesa del forecast**  
   Mitigacion: escenarios + confidence + copy de supuestos.

3. **Recomendaciones inconsistentes por costos incompletos**  
   Mitigacion: gating por data quality y warnings claros.

4. **Scope creep**  
   Mitigacion: respetar fases; no abrir write-back ni nuevas tablas innecesarias.

---

## 11) Criterio para abrir integracion PMS API (futuro)

No avanzar a write-back hasta cumplir al menos 3:

1. `action_marked_applied / generated` >= 30% sostenido.
2. evidencia de uplift en cohortes activas.
3. friccion manual reportada como principal barrera.
4. cobertura comercial alta en PMS objetivo.

---

## 12) Resumen ejecutivo

Este plan v2 prioriza lo que mueve aguja:

- decision semanal,
- accion operable,
- aprendizaje por resultados.

Sin sobrecomplicar, Financial OS puede convertirse en el ritual semanal del hotelero:  
**ver riesgo -> actuar en PMS -> medir impacto**.

---

## 13) Especificacion visual Fase 1 (lista para implementacion)

Objetivo:

- traducir Fase 1 a una UI premium, clara y operable.
- alinear diseño y frontend con una guia unica, sin ambiguedad.

### 13.1 Layout por breakpoint

### Desktop (`>=1200px`)

Orden vertical:

1. `WeeklyDecisionHero` (full width)
2. `ScenarioComparisonCards` (3 columnas)
3. `TopActionsPanel` (2/3) + `ConfidencePanel` (1/3)
4. Contexto actual: calendario + pacing + gaps + cashflow

Reglas:

- el primer viewport debe mostrar Hero + inicio de escenarios.
- no usar mas de 3 columnas efectivas de contenido.

### Tablet (`768px - 1199px`)

Orden:

1. Hero
2. Escenarios en 2 columnas (tercer escenario abajo)
3. TopActionsPanel
4. Contexto

### Mobile (`<768px`)

Orden:

1. Hero compacto
2. Escenarios en carrusel horizontal simple o stack vertical
3. Top 3 acciones (cards compactas, CTA visible sin expandir)
4. Contexto colapsable

Regla mobile:

- cada card critica debe mostrar titulo, impacto y CTA en primer bloque visible.

### 13.2 Especificacion de componentes

### `WeeklyDecisionHero`

Contenido obligatorio:

- estado: `Ahead / On track / Behind` (badge semantico).
- impacto semanal estimado (rango monetario).
- confidence: `Alta / Media / Baja` + una razon corta.
- CTA primario: "Ver acciones de esta semana".

Estados:

- normal,
- low confidence (copy de hipotesis),
- sin datos (estado vacio guiado a Importar/Costos).

### `ScenarioComparisonCards`

3 cards simetricas:

- Base,
- Conservador,
- Optimista.

Cada card:

- ocupacion esperada,
- revenue esperado,
- delta vs ritmo actual,
- mini indicador de riesgo.

Regla de diseño:

- mismo alto, mismo orden de información, misma escala visual.

### `TopActionsPanel`

Hasta 3 cards, priorizadas por impacto.

Cada card debe incluir:

- titulo accionable (verbo + canal/segmento),
- `why` en 1 linea,
- impacto esperado,
- guardrail visible ("No bajar de $X"),
- confidence,
- CTA unico.

Estados:

- sugerida,
- aplicada,
- descartada.

### `ConfidencePanel`

Resumen simple:

- score visual (alta/media/baja),
- 2-3 razones positivas/negativas,
- link "como se calcula" (tooltip o drawer).

### 13.3 Reglas de visualizacion y microcopy

Formato obligatorio por card:

1. Diagnostico
2. Accion
3. Limite

Ejemplo:

- "Venis 12 pts abajo del ritmo."
- "Subi Booking 6-8% en semana 3."
- "No bajar de $92 (piso financiero)."

No usar como copy principal:

- terminos tecnicos puros (`DBA`, `unconstrained`, etc.).
- si son necesarios, mover a tooltip de soporte.

### 13.4 Tokens visuales y consistencia

Semantica:

- `success`: oportunidad controlada
- `warning`: riesgo manejable
- `error`: riesgo critico
- `info`: contexto

Reglas:

- nunca comunicar estado solo con color (sumar icono + texto).
- mantener contraste AA minimo en labels y badges.
- evitar mas de dos pesos tipograficos por card.

### 13.5 Interacciones y navegación

Cada CTA debe:

- resolver a una pantalla concreta con ancla:
  - pricing -> `/rentabilidad#...`
  - visibilidad/canales -> `/canales#...`
- disparar telemetria de click.
- conservar contexto (periodo/horizonte) cuando aplique.

### 13.6 Estados y edge cases (obligatorio)

Implementar explicitamente:

1. `loading` por bloque (no spinner global largo).
2. `empty` (sin datos) con CTA accionable.
3. `error` recuperable ("reintentar" + mensaje claro).
4. `low confidence` con copy de hipotesis.
5. `approximate pacing` con aviso no intrusivo.

### 13.7 Definition of Quality visual (DoQ)

La fase no se cierra si no cumple:

1. "Que hago esta semana" identificable en <10 segundos.
2. Hero + escenarios + 1 accion visible en primer scroll.
3. CTA principal visible sin hover ni expansión.
4. Mobile legible y accionable en pantalla chica.
5. Coherencia semantica de estados en toda la vista.

### 13.8 QA checklist visual (diseño + frontend)

- [ ] Jerarquia visual cumple orden definido.
- [ ] Cada card de accion tiene impacto + guardrail + confidence.
- [ ] Escenarios comparables en formato y escala.
- [ ] Badges de estado consistentes en toda la pagina.
- [ ] Empty/Error/Low confidence implementados.
- [ ] Navegacion por CTA lleva al destino correcto.
- [ ] Telemetria de click funciona en CTAs criticos.
- [ ] Validado en desktop, tablet y mobile.
