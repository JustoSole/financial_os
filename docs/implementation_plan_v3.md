# Financial OS — Plan de Implementación v3.1

## Visión: De analítico a accionable

**Objetivo:** Convertir Financial OS de un sistema que *muestra datos* a un sistema que *genera acciones concretas con output operable*. Sin agregar complejidad innecesaria, tabs, ni alertas prematuras.

**Principio rector:** La unidad de producto no es la métrica, es la **acción**. Si un número no lleva a una acción clara, sobra.

**Cambio de mindset:**
```
ANTES: Usuario ve métricas → piensa qué hacer → decide → ejecuta en otro lado
AHORA: Usuario ve métricas → sistema sugiere acción → genera lista de cambios → marca como aplicado
```

---

## Estado Actual (auditoría honesta)

### ✅ Lo que funciona muy bien

| Área | Componente | Calidad |
|------|-----------|---------|
| Command Center | Home.tsx | Excelente — responde "¿estoy ganando?" en 60s |
| Break-even | ThresholdsView en Profitability | Sólido — piso financiero claro |
| Simulador de precio mínimo | Profitability.tsx | Funciona — slider con evidencia |
| Canales | Channels.tsx | Bueno — profit/noche por canal visible |
| Proyecciones básicas | Projections.tsx | Funciona — OTB y pacing semanal |
| Trust Layer | Badges de confianza | Diferenciador — "Real vs Estimado" |

### ⚠️ Lo que falta para alto valor

| Gap | Impacto | Estado |
|-----|---------|--------|
| **Profit proyectado** | Alto — sin esto no se evalúa rentabilidad futura | No existe |
| **Net parity** | Alto — pregunta #1 de pricing | No existe |
| **Estrategia activa** | Alto — el sistema es reactivo, no proactivo | Solo doc, no implementado |
| **Gaps → Acciones** | Medio — se detectan pero no conectan | Botón genérico sin destino |
| **Room type pricing** | Medio — si hay segmentación, es clave | Solo filtro, no análisis |

### 🔧 Código reutilizable (no reinventar)

```
backend/src/services/
├── calculation-engine.ts    ✅ Motor central — REUTILIZAR
│   ├── getChannelMetrics()  ✅ ADR neto, comisiones, profit/noche
│   ├── getProfitability()   ✅ Costos, márgenes
│   ├── calculateProjections() ✅ Proyecciones básicas
│   └── getReservationEconomicsSummary() ✅ Patterns, worst/best
├── projections-service.ts   ✅ OTB, pacing, gaps — EXTENDER
├── metrics-service.ts       ✅ DOW, YoY, MoM — REUTILIZAR
└── costs-utils.ts           ✅ Cálculos de costos — REUTILIZAR

frontend/src/pages/
├── Profitability.tsx        ✅ ThresholdsView, PatternsView — EXTENDER
├── Projections.tsx          ✅ Calendario, pacing chart — MEJORAR
└── Channels.tsx             ✅ Tabla de canales — AGREGAR sección
```

---

## Mejoras Propuestas (3 prioridades)

### Prioridad 1: Proyecciones con Profit (modelo correcto)

**Pregunta que resuelve:** "¿Voy a ganar plata las próximas semanas o solo voy a tener ocupación?"

**Estado actual:**
- `projections-service.ts` calcula `revenueOTB` y `occupancyOTB`
- NO calcula profit proyectado
- El usuario ve ingresos pero no sabe si serán rentables

**⚠️ PROBLEMA CRÍTICO a evitar:**

Si mostramos "Profit proyectado" como un número simple, será **conceptualmente mentiroso** porque:
- **Costos variables**: dependen de noches OTB ✓
- **Comisiones**: dependen de canal y comisión efectiva ✓
- **Costos fijos**: NO dependen de noches OTB, dependen del **tiempo** (el mes corre igual)

Si el usuario tiene 20% ocupación proyectada y mostramos profit positivo, nos van a decir:
> "¿cómo puede ser que con 20% ocupación tengas margen positivo?"

**Solución: Mostrar DOS métricas, no una**

```
ANTES:
┌─────────────────────────────────────┐
│ Revenue OTB: $45,000                │
│ Ocupación: 65%                      │
│ (¿Es bueno? No sé...)               │
└─────────────────────────────────────┘

DESPUÉS:
┌─────────────────────────────────────────────────────────────────┐
│ CERTEZA OPERATIVA                                               │
├─────────────────────────────────────────────────────────────────┤
│ Revenue OTB: $45,000                                            │
│ Ocupación confirmada: 65%                                       │
├─────────────────────────────────────────────────────────────────┤
│ CONTRIBUCIÓN OTB (alto grado de verdad)            [Real ●]     │
│ $28,500                                                         │
│ = Revenue - Variables - Comisiones                              │
│ "Lo que te queda antes de pagar fijos"                          │
├─────────────────────────────────────────────────────────────────┤
│ PROFIT FULLY-LOADED (con supuesto)                 [Estimado ◐] │
│ $12,500                                                         │
│ = Contribución - Fijos prorrateados                             │
│ Supuesto: Fijos del mes / 30 días × horizonte                   │
├─────────────────────────────────────────────────────────────────┤
│ ADR OTB vs Piso Variable: +$45 ✓                                │
│ ADR OTB vs Piso Fully-loaded: +$18 ⚠️                           │
└─────────────────────────────────────────────────────────────────┘
```

**Definiciones exactas:**

```typescript
// 1. Contribución OTB (confiable, sin supuestos)
contributionOTB = revenueOTB - variableCostsOTB - commissionsOTB

// 2. Profit fully-loaded (con supuesto de prorrateo de fijos)
fixedCostsForHorizon = (monthlyFixedCosts / 30.44) * horizonDays
profitFullyLoaded = contributionOTB - fixedCostsForHorizon

// 3. ADR OTB vs pisos (dos comparaciones)
adrOTB = revenueOTB / nightsOTB
gapVsFloorVariable = adrOTB - breakEvenPriceVariable  // guardrail no negociable
gapVsFloorFullyLoaded = adrOTB - breakEvenPriceFullyLoaded  // objetivo
```

**Trust badges obligatorios:**
- Contribución OTB: `[Real ●]` — no tiene supuestos
- Profit fully-loaded: `[Estimado ◐]` — tiene supuesto de prorrateo

**Implementación:**

1. **Backend:** Extender `ProjectionsService.calculateOTBSummary()`
   - Reutilizar `getVariableCostPerNight()` de `costs-utils.ts`
   - Calcular: `contributionOTB`, `profitFullyLoaded`
   - Agregar: `gapVsFloorVariable`, `gapVsFloorFullyLoaded`
   - Incluir: `assumptions` object con los supuestos usados

2. **Frontend:** Agregar sección en `Projections.tsx`
   - Separar visualmente Contribución (confiable) vs Profit (estimado)
   - Trust badges junto a cada número
   - Tooltip que explica el supuesto de fijos

**Archivos a modificar:**
- `backend/src/services/projections-service.ts` — extender `calculateOTBSummary()`
- `shared/src/types/metrics.ts` — agregar tipos con `assumptions`
- `frontend/src/pages/Projections.tsx` — agregar sección con trust badges

**Riesgo:** Bajo — es extensión, no reemplazo. Pero requiere UI cuidadosa para no confundir.

---

### Prioridad 2: Net Revenue Parity (Paridad de Ingreso Neto)

**Pregunta que resuelve:** "¿Qué precio pongo en Booking para que me quede lo mismo neto que con reserva directa?"

**Estado actual:**
- `getChannelMetrics()` ya calcula `adrNet` por canal
- `directAdr` existe como referencia
- NO hay cálculo explícito de "qué precio iguala directo"

**⚠️ Definición correcta (Net Revenue Parity):**

```
Objetivo: Que el neto después de comisión en OTA sea igual al neto directo.

Ejemplo:
- Precio directo: $120
- Neto directo (sin comisión): $120
- Comisión Booking: 15%

Para igualar $120 neto en Booking:
precio_paridad_booking = $120 / (1 - 0.15) = $141.18

Es decir: en Booking deberías cobrar $141 para ganar lo mismo que $120 directo.
```

**Fórmula exacta:**
```typescript
// Net Revenue Parity (recomendado, simple y defendible)
net_direct = price_direct - fees_direct  // Usualmente fees_direct = 0
price_ota_parity = net_direct / (1 - commission_effective_ota)

// Gap de paridad
gap = price_actual_ota - price_ota_parity
// Si gap < 0: estás vendiendo más barato de lo que deberías
// Si gap > 0: estás vendiendo más caro (ok, ganás más)
```

**Mejora propuesta:**

```
ANTES (Channels.tsx):
┌────────────────────────────────────────────────┐
│ Canal     │ ADR    │ Comisión │ Profit/Noche  │
│ Directo   │ $120   │ 0%       │ $85           │
│ Booking   │ $130   │ 15%      │ $75           │ ← ¿Está bien?
│ Expedia   │ $125   │ 18%      │ $67           │
└────────────────────────────────────────────────┘
(El usuario no sabe si sus precios OTA son correctos)

DESPUÉS:
┌─────────────────────────────────────────────────────────────────────┐
│ PARITY CHECK                                                        │
│ Referencia: ADR Directo $120 (neto $120)                            │
├─────────────────────────────────────────────────────────────────────┤
│ Canal     │ Precio actual │ Precio paridad │ Gap      │ Estado     │
│ Booking   │ $130          │ $141           │ -$11     │ ❌ Bajo    │
│ Expedia   │ $125          │ $146           │ -$21     │ ❌ Bajo    │
│ Airbnb    │ $150          │ $143           │ +$7      │ ✓ Ok      │
├─────────────────────────────────────────────────────────────────────┤
│ 💡 Acción: Subí Booking +8% ($130→$141) para igualar tu neto       │
│    Impacto estimado: +$1,200/mes (basado en 110 noches Booking)    │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementación:**

1. **Backend:** Agregar método en `calculation-engine.ts`
   ```typescript
   calculateNetParity(): NetParityAnalysis {
     const channels = this.getChannelMetrics();
     const directChannel = channels.find(c => isDirect(c.source));
     const netDirect = directChannel?.adr || this.getAverageADR();
     
     return channels
       .filter(c => !isDirect(c.source))
       .map(c => {
         const priceParidad = netDirect / (1 - c.effectiveCommissionRate);
         const gap = c.adr - priceParidad;
         return {
           channel: c.source,
           currentPrice: c.adr,
           parityPrice: priceParidad,
           gap,
           percentageChange: ((priceParidad - c.adr) / c.adr) * 100,
           status: gap >= 0 ? 'ok' : gap > -10 ? 'warning' : 'critical',
           estimatedImpact: Math.abs(gap) * c.roomNights * (30 / periodDays)
         };
       });
   }
   ```

2. **Frontend:** Sección compacta en `Channels.tsx`
   - NO tabla grande nueva, sección tipo "Parity Check" compacta
   - Referencia clara: "Tu ADR directo: $X"
   - Lista de canales con gap
   - UNA recomendación destacada (la de mayor impacto)
   - Impacto mensual estimado

**Archivos a modificar:**
- `backend/src/services/calculation-engine.ts` — agregar `calculateNetParity()`
- `shared/src/types/metrics.ts` — agregar `NetParityAnalysis` type
- `frontend/src/pages/Channels.tsx` — agregar sección compacta

**Riesgo:** Bajo — cálculo simple, UI incremental. La fórmula es estándar de revenue management.

---

### Prioridad 3: Estrategia de Pricing + Execution List

**Pregunta que resuelve:** "¿Qué reglas aplico y qué cambios de precio hago ESTA SEMANA?"

**Estado actual:**
- Existe `pricing_strategy_redesign.md` con el diseño completo
- `Profitability.tsx` tiene el simulador de precio mínimo
- `patterns` existe en el backend (canal + nightsBucket)
- DOW performance existe (`calculateDOWPerformance`)
- Lead time existe en `getChannelMetrics()`
- NO hay persistencia de reglas
- NO hay conexión entre evidencia y regla
- **NO hay output operable (lista de cambios)**

**⚠️ PROBLEMA CRÍTICO: Sin "Execution List" sigue siendo dashboard**

Mostrar reglas y fugas está bien, pero el usuario termina diciendo:
> "Ok, entendí que tengo que subir Booking. ¿Pero exactamente qué precio pongo en cada fecha?"

**Solución: Agregar "Rate Change List" (output operable)**

```
┌──────────────────────────────────────────────────────────────────┐
│ ESTRATEGIA DE PRICING                                            │
│ "Definí tu piso, tus reglas y el plan de esta semana"            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [SECCIÓN 1] PISO FINANCIERO (ya existe, mejorar copy)            │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ Tu piso HOY: $85/noche (variable)                           │  │
│ │ Tu objetivo: $102/noche (con 20% margen)                    │  │
│ │ Si cobrás menos de $85, perdés plata seguro.                │  │
│ │ [Slider de margen] → Recalcular                             │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ [SECCIÓN 2] REGLAS ACTIVAS (nuevo)                               │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ ☑ Piso global: $85 mínimo                     [siempre ON]  │  │
│ │ ☑ Net Parity OTAs: +8% Booking, +12% Expedia  [sugerido]    │  │
│ │ ☐ Recargo 1 noche: +$20                       [sugerido]    │  │
│ │ ☐ Fin de semana: +10% vie/sáb                 [opcional]    │  │
│ │                                                             │  │
│ │ Impacto estimado si activás todo: +$2,400/mes               │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ [SECCIÓN 3] TOP 3 FUGAS (sintetizar patterns existentes)         │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ 1. Booking + 1 noche = -$450/mes → Regla: Recargo 1n        │  │
│ │ 2. Expedia bajo paridad = -$320/mes → Regla: Net Parity     │  │
│ │ 3. Domingo ADR bajo = -$180/mes → Regla: DOW (opcional)     │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ [SECCIÓN 4] PLAN DE ESTA SEMANA + EXECUTION LIST ★ NUEVO ★       │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ Estado: ON TRACK (+2% vs año pasado)                        │  │
│ │                                                             │  │
│ │ Semana del 10/feb: Gap detectado (35% ocu vs 55% histórico) │  │
│ │ → Recomendación: Visibilidad + promo controlada             │  │
│ │ → Límite: No bajar de $85 (tu piso)                         │  │
│ │                                                             │  │
│ │ ┌─────────────────────────────────────────────────────────┐ │  │
│ │ │ [★ GENERAR LISTA DE CAMBIOS]                            │ │  │
│ │ └─────────────────────────────────────────────────────────┘ │  │
│ │                                                             │  │
│ │ RATE CHANGE LIST (output operable)                          │  │
│ │ ┌─────────────────────────────────────────────────────────┐ │  │
│ │ │ Fechas      │ Canal    │ Regla      │ Precio → Nuevo    │ │  │
│ │ │ 10-16 feb   │ Booking  │ Net Parity │ $130 → $141 (+8%) │ │  │
│ │ │ 10-16 feb   │ Expedia  │ Net Parity │ $125 → $140 (+12%)│ │  │
│ │ │ 14-15 feb   │ Todos    │ DOW Finde  │ Base → +10%       │ │  │
│ │ │ 10-16 feb   │ Todos    │ 1 noche    │ Base → +$20       │ │  │
│ │ ├─────────────────────────────────────────────────────────┤ │  │
│ │ │ Guardrail: Ningún precio < $85 ✓                        │ │  │
│ │ │ Impacto estimado: +$850 esta semana                     │ │  │
│ │ ├─────────────────────────────────────────────────────────┤ │  │
│ │ │ [Copiar] [Exportar CSV] [✓ Marcar como aplicado]        │ │  │
│ │ └─────────────────────────────────────────────────────────┘ │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ [SECCIÓN 5] HISTORIAL DE ACCIONES (action log)                   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ 3/feb: Aplicaste Net Parity en Booking                      │  │
│ │ 28/ene: Activaste recargo 1 noche                           │  │
│ │ → Resultado: ADR subió +$12 vs semana anterior              │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ [SECCIÓN 6] DETALLE (acordeones, sin tabs)                       │
│ ▶ Ver todos los patrones                                         │
│ ▶ Ver mejores/peores reservas                                    │
│ ▶ Ver performance por día de semana                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Implementación (fases):**

**Fase 3a: Reglas + Execution List (sin persistencia)**
1. Reestructurar `Profitability.tsx` (layout vertical, sin tabs)
2. Crear `StrategyRulesSection.tsx` (reglas con toggle)
3. Crear `TopLeaksSection.tsx` (sintetizar patterns existentes)
4. Crear `WeeklyPlanSection.tsx` con:
   - Estado de pacing (on track / behind / ahead)
   - Gaps de proyecciones
   - **Botón "Generar lista de cambios"**
   - **Componente `RateChangeList`** (tabla exportable)
   - **Botón "Marcar como aplicado"**
5. Crear `ActionLogSection.tsx` (historial local, sin DB)

**Fase 3b: Persistencia**
1. Nueva tabla `pricing_actions` en Supabase
   ```sql
   pricing_actions (
     id, property_id, 
     action_type, -- 'rate_change_applied', 'rule_activated'
     data JSONB,  -- { ruleId, changes: [...], impactEstimated }
     applied_at,
     result_adr_before, result_adr_after -- para feedback
   )
   ```
2. Endpoint para guardar/cargar acciones
3. Feedback: "Aplicaste X, tu ADR subió Y%"

**Fase 3c: Conexión completa**
1. Mejorar `detectGaps()` para sugerir regla específica
2. Link desde `/proyecciones` → `/rentabilidad` con gap preseleccionado
3. Home: "Top 3 Actions" con link a rate change list

**Backend: Generación de Rate Change List**

```typescript
// En calculation-engine.ts o nuevo pricing-service.ts
generateRateChangeList(activeRules: Rule[], period: DatePeriod): RateChange[] {
  const changes: RateChange[] = [];
  const channels = this.getChannelMetrics();
  const parity = this.calculateNetParity();
  const floor = this.getBreakEvenPrice();
  
  // Aplicar cada regla activa
  for (const rule of activeRules) {
    if (rule.type === 'net_parity') {
      parity.forEach(p => {
        if (p.gap < 0) {
          changes.push({
            dateRange: period,
            channel: p.channel,
            rule: 'Net Parity',
            currentPrice: p.currentPrice,
            newPrice: Math.max(p.parityPrice, floor), // nunca bajo el piso
            delta: p.percentageChange,
            guardrailOk: p.parityPrice >= floor
          });
        }
      });
    }
    // ... otras reglas (LOS, DOW, etc.)
  }
  
  return changes;
}
```

**Archivos a modificar:**

Fase 3a:
- `frontend/src/pages/Profitability.tsx` — reestructurar layout
- `frontend/src/components/strategy/StrategyRulesSection.tsx` — nuevo
- `frontend/src/components/strategy/TopLeaksSection.tsx` — nuevo
- `frontend/src/components/strategy/WeeklyPlanSection.tsx` — nuevo
- `frontend/src/components/strategy/RateChangeList.tsx` — nuevo (★ clave)
- `frontend/src/components/strategy/ActionLogSection.tsx` — nuevo
- `backend/src/services/calculation-engine.ts` — agregar `generateRateChangeList()`

Fase 3b:
- `backend/src/db/supabase-adapter.ts` — agregar métodos para actions
- `backend/src/routes/api.ts` — endpoints CRUD
- `shared/src/types/api.ts` — tipos

**Riesgo:** Medio — requiere reestructurar Profitability pero sin romper funcionalidad actual. El RateChangeList es la pieza que convierte esto en producto.

---

## Plan de Ejecución (reordenado para maximizar "wow" temprano)

### Semana 1: Proyecciones con Profit + CTA a Acciones

| Día | Tarea | Entregable |
|-----|-------|-----------|
| 1 | Revisar `projections-service.ts` y `costs-utils.ts` | Entendimiento completo |
| 2 | Implementar `contributionOTB` y `profitFullyLoaded` con supuestos | Backend funcionando |
| 3 | Agregar tipos con `assumptions` en `shared/src/types/metrics.ts` | Tipos actualizados |
| 4 | Crear sección en Projections.tsx con trust badges | UI con confianza clara |
| 5 | Agregar CTA: "Gaps detectados → Ver plan semanal" | Anchor a Rentabilidad |

**Criterio de éxito:**
- El usuario ve: Contribución OTB (confiable) + Profit fully-loaded (con supuesto)
- Trust badges junto a cada número
- CTA que conecta gaps → rentabilidad

---

### Semana 2: Net Parity (acción obvia #1)

| Día | Tarea | Entregable |
|-----|-------|-----------|
| 1 | Agregar `calculateNetParity()` con fórmula correcta | Cálculo funcionando |
| 2 | Agregar tipos `NetParityAnalysis` | API lista |
| 3 | Crear sección "Parity Check" compacta en Channels.tsx | UI básica |
| 4 | Agregar recomendación con impacto mensual estimado | Insight accionable |
| 5 | Pruebas con datos reales, ajustar cálculos | Feature completa |

**Criterio de éxito:**
- El usuario ve: "Booking necesita +8% para igualar tu neto directo"
- Impacto mensual estimado: "+$1,200/mes"
- Una acción clara y defendible

---

### Semanas 3-4: Estrategia + Execution List

| Día | Tarea | Entregable |
|-----|-------|-----------|
| 1-2 | Reestructurar Profitability.tsx (layout vertical, sin tabs) | Estructura nueva |
| 3 | Crear StrategyRulesSection (reglas con toggle) | Sección de reglas |
| 4 | Crear TopLeaksSection (sintetizar patterns) | Top 3 fugas |
| 5-6 | Crear WeeklyPlanSection + **RateChangeList** (★ clave) | Plan semanal con output |
| 7 | Agregar botones: Copiar, Exportar CSV, Marcar aplicado | Output operable |
| 8 | Crear ActionLogSection (historial local) | Feedback básico |
| 9 | Conectar gaps → reglas desde Proyecciones | Flow completo |
| 10 | Pulir UI, testing con datos reales | Feature completa |

**Criterio de éxito:**
- El usuario puede **generar una lista de cambios de precio** exportable
- Puede **marcar como aplicado** y ver historial
- Ningún precio recomendado está bajo el piso (guardrail visible)
- El flujo completo: Proyecciones → Gaps → Estrategia → Rate Change List → Aplicar

---

### Semana 5 (opcional): Top 3 Actions en Home + Persistencia

| Día | Tarea | Entregable |
|-----|-------|-----------|
| 1-2 | Agregar sección "Top 3 Actions" en Home.tsx | Home accionable |
| 3-4 | Persistir acciones en `pricing_actions` table | Historial real |
| 5 | Feedback: "Aplicaste X, tu ADR subió Y%" | Loop cerrado |

**Criterio de éxito:**
- Home muestra: "Esta semana: 3 acciones con impacto $X"
- El usuario puede marcar "hecho" desde Home
- Historial persiste y muestra resultados

---

---

## Home: Top 3 Actions (mejora de Command Center)

**Problema:** Home es excelente para "¿estoy ganando?", pero no dice "¿qué hago?"

**Solución:** Agregar sección "Top 3 Actions" después del hero de profit.

```
┌──────────────────────────────────────────────────────────────────┐
│ [Hero de Profit actual - ya existe, está bien]                   │
├──────────────────────────────────────────────────────────────────┤
│ ESTA SEMANA: 3 ACCIONES CON IMPACTO                              │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ 1. Subir Booking +8% (Net Parity)        Impacto: +$1,200   │  │
│ │    [Ver detalle] [✓ Marcar hecho]                           │  │
│ │                                                             │  │
│ │ 2. Activar recargo 1 noche               Impacto: +$450     │  │
│ │    [Ver detalle] [✓ Marcar hecho]                           │  │
│ │                                                             │  │
│ │ 3. Revisar gap semana del 10/feb         Riesgo: -$800      │  │
│ │    [Ver en Proyecciones]                                    │  │
│ └─────────────────────────────────────────────────────────────┘  │
│ Impacto total estimado: +$1,650/mes                              │
├──────────────────────────────────────────────────────────────────┤
│ [Resto del Command Center actual]                                │
└──────────────────────────────────────────────────────────────────┘
```

**Implementación:**
- Reutilizar datos de: `calculateNetParity()`, `generateActions()`, `detectGaps()`
- Componente: `TopActionsSection.tsx` (reutilizar estilos de StatusCard)
- Persistencia de "marcar hecho": usar `action_completions` existente

**Prioridad:** Semana 5 (después de que existan las acciones)

---

## Instrumentación Mínima (PLG validation)

**Por qué:** Sin métricas, no sabemos si el refactor logró el cambio de "analítico → estratégico".

**3 eventos críticos a medir:**

| Evento | Qué indica | Dónde se dispara |
|--------|-----------|------------------|
| `weekly_plan_viewed` | El usuario busca qué hacer | WeeklyPlanSection monta |
| `rate_change_list_generated` | El usuario quiere output concreto | Click en "Generar lista" |
| `action_marked_applied` | El usuario ejecutó algo | Click en "Marcar aplicado" |

**Implementación sugerida:**
```typescript
// utils/analytics.ts (simple, sin dependencias externas)
export function trackEvent(event: string, properties?: Record<string, any>) {
  // Opción 1: Console para desarrollo
  console.log('[Analytics]', event, properties);
  
  // Opción 2: Supabase (ya lo tenés)
  // supabase.from('analytics_events').insert({ event, properties, timestamp: new Date() });
  
  // Opción 3: Posthog/Mixpanel cuando escales
}
```

**Métrica de éxito:**
- Si `rate_change_list_generated` > 0 en la primera semana → el producto funciona
- Si `action_marked_applied / rate_change_list_generated` > 30% → el usuario confía en las recomendaciones

---

## Principios de Diseño (no negociables)

### 1. Reutilización máxima
- NO crear nuevos servicios si existe lógica en `calculation-engine.ts`
- NO crear nuevos componentes si existe uno similar
- Extender antes de crear

### 2. UI consistente
- Usar CSS Modules existentes
- Reutilizar `Card`, `Badge`, `ProgressBar` de `components/ui`
- Mantener el dark theme actual
- No agregar nuevas fuentes ni colores

### 3. Mobile-first
- Todas las secciones deben funcionar en móvil
- Usar grid responsivo existente
- Colapsar acordeones en móvil

### 4. Copy accionable
- Cada insight debe tener una acción clara
- Evitar jerga técnica (GOPPAR → "Ganancia por habitación")
- Usar números concretos ($X, Y%)

### 5. Trust first
- Mantener badges de confianza en proyecciones
- Si un número es estimado, decirlo
- No prometer precisión falsa

---

## Checklist de Calidad

### Antes de cada PR

- [ ] ¿Reutiliza código existente al máximo?
- [ ] ¿Funciona en móvil?
- [ ] ¿Mantiene el diseño actual (no agrega tabs, alertas)?
- [ ] ¿El copy es accionable y sin jerga?
- [ ] ¿Tiene tests básicos?
- [ ] ¿Los tipos están actualizados en `shared/`?

### Validación de feature completa

- [ ] El usuario puede responder una pregunta nueva en <30 segundos
- [ ] Hay una acción clara asociada al nuevo dato
- [ ] No se rompe ninguna funcionalidad existente
- [ ] El rendimiento no degradó (no hay queries N+1)

---

## Qué NO hacer (explícito)

1. **NO agregar tabs en Rentabilidad** — usar secciones verticales con acordeones
2. **NO crear sistema de alertas** — todavía no es necesario
3. **NO agregar ML/forecasting complejo** — reglas simples basadas en evidencia
4. **NO crear páginas nuevas** — mejorar las existentes
5. **NO agregar configuración excesiva** — defaults inteligentes primero
6. **NO sobre-diseñar tipos** — solo lo necesario

---

## Métricas de éxito post-implementación

### Métricas de producto (UX)

| Métrica | Target | Cómo medir |
|---------|--------|-----------|
| Tiempo para generar rate change list | <2 minutos | User testing |
| Acciones con output operable | 100% de features | Review de UI |
| Confianza en números | Trust badges en todos los estimados | Code review |

### Métricas de engagement (PLG)

| Métrica | Target | Cómo medir |
|---------|--------|-----------|
| `weekly_plan_viewed` | >50% de usuarios activos/semana | Analytics |
| `rate_change_list_generated` | >1 por usuario/semana | Analytics |
| `action_marked_applied` / generated | >30% | Analytics |

### Métricas técnicas

| Métrica | Target | Cómo medir |
|---------|--------|-----------|
| Código nuevo vs reutilizado | <30% nuevo | Git diff |
| Regresiones | 0 | Tests existentes pasan |
| Performance | No degradar >10% | Lighthouse |

---

## Resumen ejecutivo

| Semana | Feature | Entregable clave | Archivos principales |
|--------|---------|------------------|---------------------|
| 1 | Proyecciones con Profit | Contribución OTB + Profit con supuestos + Trust badges | projections-service.ts, Projections.tsx |
| 2 | Net Parity | Parity Check con recomendación e impacto | calculation-engine.ts, Channels.tsx |
| 3-4 | Estrategia + Execution | **Rate Change List exportable** + Marcar aplicado | Profitability.tsx, RateChangeList.tsx |
| 5 | Top 3 Actions + Persistencia | Home accionable + Historial con feedback | Home.tsx, pricing_actions table |

**Total estimado:** 5 semanas para el refactor completo.

**Resultado esperado:** 
- El usuario puede **generar una lista de cambios de precio** en <2 minutos
- Puede **exportar, copiar y marcar como aplicado**
- Puede **ver resultados** de acciones anteriores
- Financial OS pasa de "dashboard analítico" a "sistema de pricing workflow"

---

## Diferencia clave vs v3.0

| Aspecto | v3.0 (anterior) | v3.1 (actual) |
|---------|----------------|---------------|
| Profit proyectado | Un número simple | Contribución (confiable) + Fully-loaded (con supuestos) |
| Net Parity | Fórmula incorrecta | Net Revenue Parity con fórmula estándar |
| Estrategia | Reglas + visualización | Reglas + **Rate Change List** (output operable) |
| Home | Solo métricas | Métricas + **Top 3 Actions** |
| Validación | Sin tracking | 3 eventos críticos para PLG |

---

*Documento creado: 4 de febrero, 2026*
*Versión: 3.1 — Incorpora feedback crítico sobre ejecución y supuestos*

