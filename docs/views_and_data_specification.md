# Financial OS - Especificación de Vistas y Datos v2.0

> Documentación de alto nivel de todas las vistas, componentes y datos de la aplicación.
> **Actualizado para Command Center Edition**

---

## 🏗️ Arquitectura

| Capa | Stack |
|------|-------|
| Frontend | React 18 + TypeScript + Vite + Recharts + Tailwind |
| Backend | Node.js + Express + TypeScript |
| Database | JSON (In-memory con persistencia en `financial_os.json`) |

---

## 🗺️ Navegación

| Ruta | Vista | Descripción |
|------|-------|-------------|
| `/` | **Command Center** | Dashboard principal que responde las 40 preguntas clave |
| `/acciones` | Acciones | Lista completa de recomendaciones |
| `/canales` | Canales | Análisis de distribución, profit per night y comisiones |
| `/caja` | Caja | Reconciliación, A/R Aging y proyección de flujo |
| `/rentabilidad` | Rentabilidad | P&L por reserva, break-even y análisis de patrones |
| `/costos` | Costos | Configuración de costos operativos y room count |
| `/importar` | Importar | Carga de reportes CSV |
| `/configuracion` | Settings | Ajustes de propiedad y plan |

---

## 📊 Vista: Home — Command Center (v2.1)

El Command Center es la vista principal que responde a las preguntas críticas para la **toma de decisiones** en 90 segundos.

### Estructura de Secciones

#### 1. Banners de Estado
*   **Data Confidence Banner:** Score (0-100) y nivel de confianza.
*   **History Warning Banner:** Alerta de cobertura histórica insuficiente.

#### 2. Weekly Action Card (Prominent)
La **única acción más importante** de la semana. Ahora con diseño visualmente dominante y CTA de "Ver por qué".

#### 3. Estado Actual
*   **Hero Profit con Contexto:** Net Profit del período comparado visualmente con el período anterior (MoM) y estado frente al Break-even.
*   **Quick Indicators:** 3 tarjetas de estado compacto con semáforos:
    *   **Ocupación:** Saludable / Baja.
    *   **Margen / Noche:** Ganando / Perdiendo.
    *   **Punto de Equilibrio:** Arriba / Debajo.
*   **Date Range Picker:** Selector de fechas flexible con soporte para rangos personalizados y comparativas automáticas.

#### 4. Canales y Distribución (Resumen)
*   **OTA Dependency Bar:** Visualización compacta de Directo vs Portales.
*   **Highlights:** Identificación directa del Mejor y Peor canal por profit real.

#### 5. Análisis Profundo (Navegación)
Links directos con descripción a las vistas de detalle:
*   **Rentabilidad y P&L**
*   **Canales Detallados**
*   **Gestión de Costos**

---

## 📈 Vista: Rentabilidad

### Resumen del Período
* Net Profit Total, GOPPAR (Gross Operating Profit Per Available Room), Margen Promedio y alertas de reservas no rentables.

### Sistema de Navegación por Tabs
1.  **Umbrales:** Punto de equilibrio detallado y desgloses de costos.
2.  **Análisis:** 
    *   **Tendencias Históricas:** Gráficos de área de los últimos 6 meses (Revenue, Profit, Occ, ADR).
    *   **Comparativas MoM/YoY:** Tablas detalladas de crecimiento respecto al mes y año anterior.
3.  **Peores/Mejores:** Listado de las 20 reservas extremas.
4.  **Patrones:** Combinaciones críticas que generan pérdida.
5.  **Todas:** Listado completo filtrable.

### Reservation Drawer (Detalle P&L)
Al hacer clic en una reserva, se abre un drawer con:
*   **Resumen de Profit:** Net Profit, Profit/noche y Margen %.
*   **Desglose P&L:** Revenue - Comisiones - Costos Variables - Costos Fijos.
*   **Análisis Inteligente:** Explicación textual de "por qué pasó" la pérdida (ej. "Estadía corta con altos costos variables").
*   **Memoria de Cálculo:** Listado paso a paso de todas las fórmulas aplicadas.
*   **Confidence Badges:** Nivel de precisión del dato (Real/Estimado) y motivos de confianza.

---

## 📈 Vista: Canales

### Resumen (3 cards)
- Ingresos totales
- Comisiones totales
- Comisión promedio (%)

### Visualizaciones
- **Pie Chart:** Distribución de ingresos por canal
- **Bar Chart:** Profit per night por canal

### Tabla de Detalle
| Canal | Ingresos | Comisión | Tasa % | Noches | Profit/Noche |
|-------|----------|----------|--------|--------|--------------|

### Comisiones por Defecto (Fallback)
```typescript
{ "booking.com": 15%, "expedia": 18%, "hotels.com": 20%, 
  "airbnb": 3%, "vrbo": 8%, "agoda": 15%, "direct": 0% }
```

---

## 💰 Vista: Caja

### Card Principal: Días de Tranquilidad
| Estado | Condición | Mensaje |
|--------|-----------|---------|
| Excellent | ∞ | "Caja creciendo, buen momento para invertir" |
| Good | ≥60 días | "Colchón saludable" |
| Warning | ≥30 días | "Colchón bajando, revisar egresos" |
| Danger | <30 días | "Riesgo de caja, acción inmediata" |

### Reconciliación
- Cargado vs Cobrado con gap explicado

### A/R Aging Visual
- Buckets: Vencido / 7 días / 30 días / Futuro
- Montos por bucket

### Proyección de Flujo
```
Saldo inicial + Ingresos proyectados - Egresos proyectados = Flujo neto
```

---

## ⚙️ Vista: Costos

### Secciones de Configuración
| Sección | Contenido |
|---------|-----------|
| **Room Count** | Cantidad de habitaciones (crítico para cálculos) |
| **Saldo** | Saldo inicial de caja para cálculo de runway |
| **Variables** | Categorías flexibles (Limpieza, Lavandería, Amenities, etc.) |
| **Fijos** | Categorías flexibles (Sueldos, Alquiler, Servicios, etc.) |
| **OTAs** | Comisiones por canal detectado en PMS + Default |
| **Pasarela** | Fees de cobro por método (MercadoPago, Stripe, etc.) |

### Preview Instantáneo
"Con estos costos, tu break-even es X% ocupación"

---

## 📤 Vista: Importar

### Reportes Soportados (Cloudbeds CSV)
*   **Expanded Transaction Report with Details:** Hasta 3 años de antigüedad.
*   **Reservations with Financials:** Hasta 3 años de antigüedad.
*   **Channel Performance Summary:** Hasta 3 años de antigüedad.

**Recomendación:** Cargar al menos los últimos **13 meses** para habilitar el análisis de tendencias y comparativas YoY.

### Flujo de Importación
1.  **Upload:** Drag & drop o selector de archivos múltiples.
2.  **Validate:** Detección automática de tipo de reporte y validación de columnas.
3.  **Import:** Procesamiento en background con barra de progreso por archivo.
4.  **Complete:** Pantalla de celebración con acceso directo al Command Center.

### Historial
Lista de archivos procesados con estado, cantidad de registros, tipo detectado y fecha exacta de carga.

---

## 🔧 Vista: Configuración

### Secciones
| Sección | Contenido |
|---------|-----------|
| **Propiedad** | Nombre, Moneda (USD, MXN, EUR, etc.) |
| **Plan** | Free / Pro / Partner con features |
| **Inbox Connect** | Email de ingesta (Pro+) |
| **Privacidad** | Exportar datos, eliminar cuenta |

### Límites por Plan
| Feature | Free | Pro | Partner |
|---------|------|-----|---------|
| Propiedades | 1 | 1 | ∞ |
| Imports/mes | 1 | ∞ | ∞ |
| Historial | 30d | 365d | 365d |
| Inbox Connect | ❌ | ✅ | ✅ |

---

## 🧩 Componentes Clave
| Componente | Props Principales |
|------------|-------------------|
| `MetricCard` | title, value, delta, tooltip, isEstimate, confidence, icon, prefix/suffix |
| `ActionCard` | type, title, description, impact, confidence, steps[], priority |
| `DataHealthBanner` | score, issues[], lastImport |
| `DataConfidenceBanner` | confidence (level, missingForHighConfidence, missingReports) |
| `WeeklyActionCard` | action (title, impact, type, priority) |
| `KPICard` | question, value, benchmark, status, icon |
| `BreakevenGauge` | breakEvenOccupancy, currentOccupancy, gapToBreakEven |
| `UnitEconomicCard` | question, value, subtitle, isPositive, isCost |
| `ChannelInsightCard` | type (best/worst/commission), title, channel, value |
| `AgingBucket` | label, amount, status, icon |
| `CashRunway` | runwayDays, runwayStatus |
| `PeriodSelector` | Valores: 7, 30, 90 días, Custom |
| `ImportWizard` | Estados: upload → validate → importing → complete |
| `ReservationDrawer` | P&L details, Calculation Memory, AI Insights |

---

## 📦 Modelos de Datos

### Property
```typescript
{ id, name, currency, timezone, plan, created_at, updated_at }
```

### LedgerTransaction
```typescript
{ 
  id, property_id, txn_at, reservation_number, reservation_source, 
  txn_type, debits, credits, void_flag, refund_flag, adjustment_flag, 
  description, notes, txn_source, source_file_id 
}
```

### ReservationFinancial
```typescript
{ 
  id, property_id, reservation_number, status, source_category, 
  source, check_in, check_out, room_nights, room_revenue_total, 
  taxes_total, paid_amount, balance_due, suggested_deposit, 
  hotel_collect_flag, source_file_id 
}
```

### ReservationEconomics
```typescript
{
  reservationNumber, guestName, source, sourceCategory, checkIn,
  roomNights, revenue, commissionAmount, variableCosts, 
  fixedCostAllocated, netProfit, profitPerNight, marginPercent,
  isUnprofitable, trust, confidence, confidenceReasons[], calcNotes[],
  aiInsights: string[]
}
```

### ChannelSummary
```typescript
{ 
  id, property_id, source_category, source, room_nights, 
  room_revenue_total, estimated_commission, source_file_id 
}
```

### CostSettings (v4)
```typescript
{ 
  propertyId: string, 
  roomCount: number,
  startingCashBalance: number,
  // V4 flexible categories
  variableCategories: Array<{ id: string, name: string, monthlyAmount: number }>,
  fixedCategories: Array<{ id: string, name: string, monthlyAmount: number }>,
  extraordinaryCosts: Array<{ id: string, name: string, amount: number, date: string }>,
  // Commissions & fees
  channelCommissions: { defaultRate: number, byChannel: Record<string, number> },
  paymentFees: { enabled: boolean, defaultRate: number, byMethod: Record<string, number> }
}
```

### CommandCenterData (v2.1)
```typescript
{
  period: { start, end, days },
  health: {
    netProfit: { value, isPositive, trend, vsLastPeriod, vsLastPeriodPercent },
    kpis: { occupancy, adr, revpar, goppar },
    changes: { driver, explanation, impact },
    topAlert: { type, title, description, severity, actionLabel, actionLink }
  },
  breakeven: { 
    breakEvenOccupancy, currentOccupancy, gapToBreakEven, 
    nightsNeededForBreakEven, nightsSoldThisPeriod, nightsGap,
    breakEvenPrice, currentAdr, 
    marginSimulation: { margin10, margin20, margin30 },
    distanceToBreakEven: { inDollars, inNights, status },
    revparDecomposition: { occupancyContribution, adrContribution, primaryDriver }
  },
  unitEconomics: { 
    profitPerNight, contributionMargin, contributionMarginPercent,
    cpor, cporBreakdown: { fixed, variable, commission },
    costMix: { fixedPercent, variablePercent, commissionPercent },
    costAlerts: Array<{ category, trend, changePercent }>
  },
  channels: { 
    channels: Array<ChannelDetail>,
    bestChannelByProfitPerNight, worstChannelByProfitPerNight,
    otaDependency: { otaShare, directShare, isOverDependent },
    avgEffectiveCommission, toxicChannel
  },
  cash: { 
    charged, collected, gap, gapExplanation, totalPending, 
    topPendingReservations, aging, runwayDays, runwayStatus,
    cashBreakers: { refunds, voids, adjustments, total }
  },
  dataConfidence: { 
    score, level, missingForHighConfidence, realMetrics, estimatedMetrics, 
    missingReports, monthsCovered, earliestDate 
  },
  comparisons: { 
    mom: { currentPeriod, previousPeriod, metrics },
    yoy: { currentPeriod, previousPeriod, metrics }
  },
  weeklyAction: { title, impact, type, priority }
}
```

---

## 🔌 API Endpoints

### Import
- `POST /api/import/validate` - Detecta reportType + columnas + warnings
- `POST /api/import` - Importa archivo
- `POST /api/import/batch` - Importa múltiples CSVs simultáneamente
- `GET /api/import/history/:propertyId` - Historial de archivos

### Command Center (v2.1 - Unificado)
- `GET /api/metrics/:propertyId/command-center?days=30` - **Todas las métricas unificadas**

### Analytics & Intelligence
- `GET /api/metrics/:propertyId/trends?months=6` - Datos para gráficos de tendencia histórica
- `GET /api/metrics/:propertyId/projection` - Proyección de ingresos (On-the-books)
- `GET /api/metrics/:propertyId/dow` - Performance por día de la semana
- `GET /api/metrics/:propertyId/insights` - Insights generados por motor inteligente
- `GET /api/metrics/:propertyId/yoy` - Comparativa Year over Year detallada
- `GET /api/metrics/:propertyId/comparison` - Comparativa MoM detallada

### Metrics & Structure
- `GET /api/metrics/:propertyId/cash` - Runway, flujo diario y alertas
- `GET /api/metrics/:propertyId/channels` - Desglose y mix de canales con profit real
- `GET /api/metrics/:propertyId/structure` - Occupancy, ADR, RevPAR, GOPPAR
- `GET /api/metrics/:propertyId/breakeven` - Break-even analysis detallado
- `GET /api/metrics/:propertyId/ar-aging` - Aging de A/R buckets
- `GET /api/metrics/:propertyId/reconcile` - Reconciliación Cargado vs Cobrado

### Reservation Economics (P&L por Reserva)
- `GET /api/metrics/:propertyId/reservation-economics` - Summary de rentabilidad del período
- `GET /api/metrics/:propertyId/reservation-economics/list` - Listado filtrable (unprofitableOnly, source, nightsBucket)
- `GET /api/metrics/:propertyId/reservation-economics/:resNumber` - **Detalle P&L único con memoria de cálculo**
- `GET /api/data-health/:propertyId` - Score y issues de calidad de datos

### Costs & Settings
- `GET /api/costs/:propertyId` - Configuración de costos con calculated values
- `GET /api/costs/:propertyId/channels` - Canales detectados en PMS para configuración
- `PUT /api/costs/:propertyId` - Actualizar configuración V4 (Flexible Categories)

---

## 🎨 Design System

### Colores Principales
| Variable | Valor | Uso |
|----------|-------|-----|
| `--color-primary` | #0f766e | Acciones, éxito, brand |
| `--color-accent` | #f97316 | Highlights, CTAs |
| `--color-success` | #059669 | Positivo, profit |
| `--color-error` | #dc2626 | Errores, negativos, alerts |
| `--color-warning` | #d97706 | Advertencias |
| `--color-info` | #0284c7 | Información |
| `--color-text` | #1c1917 | Texto principal |
| `--color-bg` | #fafaf9 | Fondo |

### Tipografía
- Sans: Plus Jakarta Sans
- Mono: JetBrains Mono (valores numéricos)

### Badges
| Clase | Color | Uso |
|-------|-------|-----|
| `.badge-success` | Verde | Éxito, alta confianza |
| `.badge-warning` | Amarillo | Estimado, media confianza |
| `.badge-error` | Rojo | Error, baja confianza |
| indicador de confianza | ●/◐/○ | Nivel visual de precisión |
| `.badge-info` | Azul | Información |
| `.badge-neutral` | Gris | Plan Free |
| `.badge--estimated` | Amarillo | Métrica estimada |
| `.badge--real` | Verde | Métrica real |

### Status Colors para KPIs
| Status | Color | Uso |
|--------|-------|-----|
| `good` | Verde border-left | KPI saludable |
| `warning` | Amarillo border-left | KPI en zona de riesgo |
| `bad` | Rojo border-left | KPI crítico |

### Command Center Classes
```css
.command-center              /* Container principal */
.command-section             /* Cada sección con fondo blanco */
.section-header              /* Header con icono y título */
.hero-profit                 /* Métrica hero grande */
.kpi-grid                    /* Grid de 4 KPIs */
.kpi-card                    /* Card individual de KPI */
.breakeven-grid              /* Grid de break-even */
.breakeven-gauge             /* Gauge central */
.margin-simulation           /* Simulador de margen */
.unit-economics-grid         /* Grid de unit economics */
.channel-insights            /* Grid de insights de canales */
.channel-table               /* Tabla de canales */
.ota-dependency              /* Barra de dependencia OTA */
.toxic-channel               /* Alerta de canal tóxico */
.reconciliation              /* Reconciliación cargado/cobrado */
.ar-aging                    /* Aging buckets */
.cash-runway                 /* Card de runway */
.weekly-action               /* Card de acción semanal */
.confidence-banner           /* Banner de confianza de datos */
.top-alert                   /* Alerta principal */
.quick-actions               /* Links rápidos */
```

---

## 📄 Estructura CSV (Columnas Clave)

El sistema utiliza un mapeo flexible para detectar las columnas, pero estas son las principales que busca en cada reporte:

### 1. Expanded Transaction Report with Details
* **Fecha:** `Transaction Date Time - Property` (o similar)
* **Reserva:** `Reservation Number`, `Reservation Source`
* **Monto:** `Debits`, `Credits`
* **Flags:** `Void Flag`, `Refund Flag`, `Adjustment Flag`

### 2. Reservations with Financials
* **Reserva:** `Reservation Number`, `Reservation Status`
* **Fechas:** `Check-In Date`, `Check-Out Date`
* **Métricas:** `Room Nights`, `Room Revenue Total`
* **Pagos:** `Reservation Paid Amount`, `Reservation Balance Due`, `Suggested Deposit`

### 3. Channel Performance Summary
* **Canal:** `Reservation Source`, `Reservation Source Category`
* **Métricas:** `Room Nights - sum`, `Room Revenue Total - sum`
* **Comisión:** `Estimated Commission - sum`

---

## 📊 Telemetría
| Evento | Trigger |
|--------|---------|
| `view_home` | Carga Command Center |
| `view_import` | Carga importación |
| `view_profitability` | Carga rentabilidad |
| `view_channels` | Carga canales |
| `view_cash` | Carga caja |
| `command_center_loaded` | Command Center cargado completo |
| `weekly_action_clicked` | Click en acción semanal |
| `breakeven_simulation_used` | Uso del simulador de margen |
| `import_started` | Inicia import |
| `import_success/failed` | Resultado import |
| `costs_updated` | Guarda costos |
| `action_checked` | Completa paso de acción |
| `reservation_drawer_opened` | Abre detalle de reserva |

---

*Financial OS v2.1 — Command Center Edition*
