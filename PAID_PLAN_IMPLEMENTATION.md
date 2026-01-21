# 🚀 IMPLEMENTACIÓN: Features de Valor (Plan Único)

> **Objetivo:** Implementar las features que hacen valioso el producto para validar con usuarios reales.
> Sin gates, sin upgrades, sin restricciones. Solo valor.

---

## 📋 RESUMEN EJECUTIVO

### Lo que vamos a construir:

| Feature | Descripción | Impacto |
|---------|-------------|---------|
| **Date Range Picker** | Explorar cualquier período histórico | 🔴 Crítico |
| **Comparativas MoM** | Mes actual vs mes anterior | 🔴 Crítico |
| **Comparativas YoY** | vs mismo período año pasado | 🔴 Crítico |
| **Gráficos de Tendencia** | Evolución mensual de KPIs | 🟡 Alto |
| **Rentabilidad completa** | P&L por reserva sin restricciones | 🟡 Alto |

### Lo que NO vamos a hacer (por ahora):
- ❌ Sistema de planes
- ❌ Gates de features
- ❌ Lógica de upgrade
- ❌ UI de pricing
- ❌ Límites de imports

---

## 1. DATE RANGE PICKER

### 1.1 Objetivo
Permitir al usuario seleccionar cualquier rango de fechas para analizar su negocio, no solo 7/30/90 días predefinidos.

### 1.2 Comportamiento

```
┌─────────────────────────────────────────────────────┐
│  Período: [7d] [30d] [90d] [📅 Personalizado ▼]    │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Desde: [01/12/2025]  │
              │  Hasta: [20/01/2026]  │
              │                       │
              │  [Cancelar] [Aplicar] │
              └───────────────────────┘
```

### 1.3 Componente: DateRangePicker.tsx

**Ubicación:** `frontend/src/components/DateRangePicker.tsx`

**Props:**
```typescript
interface DateRangePickerProps {
  // Preset seleccionado (7, 30, 90) o null si es custom
  selectedPreset: number | null;
  
  // Rango custom (solo si selectedPreset es null)
  customRange: { start: Date; end: Date } | null;
  
  // Callbacks
  onPresetChange: (days: number) => void;
  onCustomRangeChange: (range: { start: Date; end: Date }) => void;
}
```

**Estados:**
- `isOpen`: boolean - Si el picker está abierto
- `tempStart`: Date - Fecha inicio temporal mientras edita
- `tempEnd`: Date - Fecha fin temporal mientras edita

**Validaciones:**
- `start` no puede ser mayor que `end`
- `end` no puede ser mayor que hoy
- Máximo 365 días de rango (para performance)

### 1.4 Integración con AppContext

**Actualizar:** `frontend/src/context/AppContext.tsx`

```typescript
interface AppContextType {
  // Existente
  property: Property | null;
  
  // ACTUALIZAR - Cambiar de "period" simple a objeto completo
  dateRange: {
    preset: number | null;  // 7, 30, 90, o null si es custom
    start: Date;
    end: Date;
    days: number;  // Calculado
  };
  setDateRange: (range: DateRangeInput) => void;
}

type DateRangeInput = 
  | { preset: 7 | 30 | 90 }
  | { custom: { start: Date; end: Date } };
```

### 1.5 Actualizar API calls

Todos los endpoints que usan `days` ahora aceptan `startDate` y `endDate`:

```typescript
// frontend/src/api.ts

export async function getCommandCenter(
  propertyId: string, 
  startDate: string,  // ISO string
  endDate: string     // ISO string
) {
  const params = new URLSearchParams({ startDate, endDate });
  return fetchApi(`/metrics/${propertyId}/command-center?${params}`);
}
```

### 1.6 Backend: Aceptar date range

**Actualizar:** `backend/src/routes/api.ts`

```typescript
router.get('/metrics/:propertyId/command-center', (req, res) => {
  const { propertyId } = req.params;
  const { startDate, endDate, days } = req.query;
  
  let start: string, end: string;
  
  if (startDate && endDate) {
    // Custom range
    start = startDate as string;
    end = endDate as string;
  } else {
    // Legacy: days parameter
    const d = Number(days) || 30;
    end = new Date().toISOString().substring(0, 10);
    start = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  }
  
  const data = getCommandCenterData(propertyId, start, end);
  res.json({ success: true, data });
});
```

### 1.7 Tareas

| # | Tarea | Archivo |
|---|-------|---------|
| 1.1 | Crear DateRangePicker component | `frontend/src/components/DateRangePicker.tsx` |
| 1.2 | Crear estilos | `frontend/src/components/DateRangePicker.module.css` |
| 1.3 | Actualizar AppContext con dateRange | `frontend/src/context/AppContext.tsx` |
| 1.4 | Reemplazar PeriodSelector en Home | `frontend/src/pages/Home.tsx` |
| 1.5 | Actualizar api.ts para date range | `frontend/src/api.ts` |
| 1.6 | Actualizar backend para startDate/endDate | `backend/src/routes/api.ts` |
| 1.7 | Actualizar command-center-service | `backend/src/services/command-center-service.ts` |

---

## 2. COMPARATIVAS MoM (Mes vs Mes Anterior)

### 2.1 Objetivo
Mostrar en el Command Center cómo le fue al usuario este mes comparado con el mes anterior.

### 2.2 Ubicación en UI

Después de la sección de KPIs en Home, agregar:

```
┌─────────────────────────────────────────────────────────┐
│  📊 Comparativa vs Mes Anterior                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Revenue     │  │ ADR         │  │ Ocupación   │     │
│  │ $2.5M       │  │ $45,000     │  │ 68%         │     │
│  │ ▲ +12%      │  │ ▲ +5%       │  │ ▼ -3%       │     │
│  │ vs Dic      │  │ vs Dic      │  │ vs Dic      │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Componente: ComparisonSection.tsx

**Ubicación:** `frontend/src/components/ComparisonSection.tsx`

**Props:**
```typescript
interface ComparisonSectionProps {
  title: string;
  comparisons: ComparisonMetric[];
  periodLabel: string;  // "vs Diciembre", "vs Ene 2025"
}

interface ComparisonMetric {
  label: string;
  currentValue: number;
  previousValue: number;
  formatter: (v: number) => string;
  invertColors?: boolean;  // true para costos (menos = mejor)
}
```

### 2.4 Componente: ComparisonCard.tsx

**Ubicación:** `frontend/src/components/ComparisonCard.tsx`

```typescript
interface ComparisonCardProps {
  label: string;
  currentValue: number;
  previousValue: number;
  formatter: (v: number) => string;
  periodLabel: string;
  invertColors?: boolean;
}
```

**Render:**
```tsx
function ComparisonCard({ label, currentValue, previousValue, formatter, periodLabel, invertColors }: ComparisonCardProps) {
  const change = previousValue > 0 
    ? ((currentValue - previousValue) / previousValue) * 100 
    : 0;
  
  const isPositive = invertColors ? change < 0 : change > 0;
  
  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{formatter(currentValue)}</div>
      <div className={`${styles.change} ${isPositive ? styles.positive : styles.negative}`}>
        {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(0)}%
      </div>
      <div className={styles.periodLabel}>{periodLabel}</div>
    </div>
  );
}
```

### 2.5 Backend: Endpoint MoM

El endpoint ya existe parcialmente en `calculatePeriodComparison`. Solo hay que exponerlo mejor.

**Actualizar:** `backend/src/routes/api.ts`

```typescript
router.get('/metrics/:propertyId/comparison/mom', (req, res) => {
  const { propertyId } = req.params;
  const data = calculatePeriodComparison(propertyId);
  res.json({ success: true, data });
});
```

### 2.6 Integrar en Command Center Response

**Actualizar:** `backend/src/services/command-center-service.ts`

Agregar `comparisons` al response:

```typescript
export interface CommandCenterData {
  // ... existing fields ...
  
  // NUEVO: Comparativas
  comparisons: {
    mom: {
      currentPeriod: string;      // "Enero 2026"
      previousPeriod: string;     // "Diciembre 2025"
      metrics: {
        revenue: { current: number; previous: number; changePercent: number };
        adr: { current: number; previous: number; changePercent: number };
        occupancy: { current: number; previous: number; changePercent: number };
        revpar: { current: number; previous: number; changePercent: number };
        netProfit: { current: number; previous: number; changePercent: number };
      };
    };
    yoy: {
      currentPeriod: string;      // "Enero 2026"
      previousPeriod: string;     // "Enero 2025"
      metrics: {
        revenue: { current: number; previous: number; changePercent: number };
        adr: { current: number; previous: number; changePercent: number };
        occupancy: { current: number; previous: number; changePercent: number };
      };
    } | null;  // null si no hay datos del año pasado
  };
}
```

### 2.7 Tareas

| # | Tarea | Archivo |
|---|-------|---------|
| 2.1 | Crear ComparisonCard component | `frontend/src/components/ComparisonCard.tsx` |
| 2.2 | Crear ComparisonSection component | `frontend/src/components/ComparisonSection.tsx` |
| 2.3 | Crear estilos | `frontend/src/components/ComparisonCard.module.css` |
| 2.4 | Agregar comparisons a CommandCenterData | `backend/src/services/command-center-service.ts` |
| 2.5 | Calcular MoM real | `backend/src/services/metrics-service.ts` |
| 2.6 | Integrar en Home.tsx | `frontend/src/pages/Home.tsx` |

---

## 3. COMPARATIVAS YoY (Año vs Año)

### 3.1 Objetivo
Mostrar comparación vs el mismo período del año anterior. Crítico para entender estacionalidad.

### 3.2 Ubicación en UI

Debajo de MoM, o combinado:

```
┌─────────────────────────────────────────────────────────┐
│  📅 Comparativa vs Año Anterior                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Revenue     │  │ ADR         │  │ Ocupación   │     │
│  │ $2.5M       │  │ $45,000     │  │ 68%         │     │
│  │ ▲ +25%      │  │ ▲ +18%      │  │ ▲ +8%       │     │
│  │ vs Ene '25  │  │ vs Ene '25  │  │ vs Ene '25  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ⚠️ Solo 3 meses de datos del año pasado disponibles   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Backend: Mejorar YoY Calculation

El endpoint `calculateYoYComparison` ya existe. Solo hay que:
1. Hacerlo más robusto cuando no hay datos
2. Indicar cuántos datos históricos hay

**Actualizar:** `backend/src/services/metrics-service.ts`

```typescript
export function calculateYoYComparison(propertyId: string, startDate: string, endDate: string): YoYComparison | null {
  // Calcular mismo período año anterior
  const currentStart = new Date(startDate);
  const currentEnd = new Date(endDate);
  
  const prevStart = new Date(currentStart);
  prevStart.setFullYear(prevStart.getFullYear() - 1);
  
  const prevEnd = new Date(currentEnd);
  prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  
  // Verificar si hay datos del año pasado
  const prevReservations = database.getReservationsByProperty(propertyId).filter(r => {
    const checkIn = r.check_in?.substring(0, 10);
    return checkIn >= prevStart.toISOString().substring(0, 10) && 
           checkIn <= prevEnd.toISOString().substring(0, 10);
  });
  
  if (prevReservations.length === 0) {
    return null;  // No hay datos YoY
  }
  
  // Calcular métricas...
}
```

### 3.4 Mostrar mensaje si no hay datos YoY

En el frontend, si `comparisons.yoy` es null:

```tsx
{data.comparisons.yoy ? (
  <ComparisonSection 
    title="vs Año Anterior" 
    comparisons={...} 
  />
) : (
  <div className={styles.noDataMessage}>
    <Info size={16} />
    <span>Importá datos del año pasado para ver comparativas YoY</span>
  </div>
)}
```

### 3.5 Tareas

| # | Tarea | Archivo |
|---|-------|---------|
| 3.1 | Mejorar calculateYoYComparison | `backend/src/services/metrics-service.ts` |
| 3.2 | Agregar YoY a command center response | `backend/src/services/command-center-service.ts` |
| 3.3 | Mostrar YoY en Home (o mensaje si no hay datos) | `frontend/src/pages/Home.tsx` |

---

## 4. GRÁFICOS DE TENDENCIA

### 4.1 Objetivo
Mostrar la evolución mensual de los KPIs principales para identificar tendencias.

### 4.2 Métricas a graficar

| Métrica | Descripción |
|---------|-------------|
| Revenue | Ingresos totales por mes |
| ADR | Tarifa promedio por mes |
| Occupancy | % ocupación por mes |
| RevPAR | Revenue per available room |
| Net Profit | Ganancia neta por mes |

### 4.3 Ubicación en UI

Nueva sección en Home, después de comparativas:

```
┌─────────────────────────────────────────────────────────┐
│  📈 Tendencias (últimos 6 meses)                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Revenue ▼]                                            │
│                                                         │
│     ^                                                   │
│  $3M│           ●                                       │
│     │       ●       ●   ●                               │
│  $2M│   ●               ●   ●                           │
│     │                                                   │
│  $1M│                                                   │
│     └──────────────────────────────────────────────►    │
│       Ago  Sep  Oct  Nov  Dic  Ene                      │
│                                                         │
│  📊 Revenue promedio: $2.3M  |  Tendencia: ▲ +8%        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Componente: TrendChart.tsx

**Ubicación:** `frontend/src/components/TrendChart.tsx`

```typescript
interface TrendChartProps {
  data: TrendPoint[];
  title: string;
  valueFormatter: (v: number) => string;
  color?: string;
  height?: number;
}

interface TrendPoint {
  month: string;      // "2025-12"
  label: string;      // "Dic"
  value: number;
}
```

**Implementación con Recharts:**

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

function TrendChart({ data, title, valueFormatter, color = 'var(--color-primary)', height = 200 }: TrendChartProps) {
  // Calcular tendencia
  const values = data.map(d => d.value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trendPercent = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

  return (
    <div className={styles.trendChart}>
      <div className={styles.header}>
        <h4>{title}</h4>
      </div>
      
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="label" axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip 
            formatter={(value: number) => valueFormatter(value)}
            contentStyle={{ background: 'white', border: '1px solid #e5e5e5' }}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            fill="url(#colorValue)" 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
      
      <div className={styles.summary}>
        <span>Promedio: {valueFormatter(avg)}</span>
        <span className={trendPercent >= 0 ? styles.positive : styles.negative}>
          Tendencia: {trendPercent >= 0 ? '▲' : '▼'} {Math.abs(trendPercent).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
```

### 4.5 Backend: Endpoint de Trends

**Crear:** Nuevo endpoint para obtener datos de tendencia

```typescript
// backend/src/routes/api.ts

router.get('/metrics/:propertyId/trends', (req, res) => {
  const { propertyId } = req.params;
  const { months } = req.query;
  
  const data = calculateTrendMetrics(propertyId, Number(months) || 6);
  res.json({ success: true, data });
});
```

**Crear:** `backend/src/services/trends-service.ts`

```typescript
export interface TrendData {
  months: number;
  revenue: TrendPoint[];
  adr: TrendPoint[];
  occupancy: TrendPoint[];
  revpar: TrendPoint[];
  netProfit: TrendPoint[];
}

export function calculateTrendMetrics(propertyId: string, months: number = 6): TrendData {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  const result: TrendData = {
    months,
    revenue: [],
    adr: [],
    occupancy: [],
    revpar: [],
    netProfit: [],
  };
  
  // Para cada mes en el rango
  for (let i = 0; i < months; i++) {
    const monthStart = new Date(startDate);
    monthStart.setMonth(monthStart.getMonth() + i);
    
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);  // Último día del mes
    
    const monthLabel = monthStart.toLocaleDateString('es-AR', { month: 'short' });
    const monthKey = monthStart.toISOString().substring(0, 7);
    
    // Obtener métricas del mes
    const metrics = getMonthlyMetrics(propertyId, monthStart, monthEnd);
    
    result.revenue.push({ month: monthKey, label: monthLabel, value: metrics.revenue });
    result.adr.push({ month: monthKey, label: monthLabel, value: metrics.adr });
    result.occupancy.push({ month: monthKey, label: monthLabel, value: metrics.occupancy });
    result.revpar.push({ month: monthKey, label: monthLabel, value: metrics.revpar });
    result.netProfit.push({ month: monthKey, label: monthLabel, value: metrics.netProfit });
  }
  
  return result;
}
```

### 4.6 Selector de métrica en UI

Permitir al usuario elegir qué métrica ver:

```tsx
const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'adr' | 'occupancy'>('revenue');

<div className={styles.metricSelector}>
  <button onClick={() => setSelectedMetric('revenue')} className={selectedMetric === 'revenue' ? styles.active : ''}>
    Revenue
  </button>
  <button onClick={() => setSelectedMetric('adr')} className={selectedMetric === 'adr' ? styles.active : ''}>
    ADR
  </button>
  <button onClick={() => setSelectedMetric('occupancy')} className={selectedMetric === 'occupancy' ? styles.active : ''}>
    Ocupación
  </button>
</div>

<TrendChart 
  data={trends[selectedMetric]} 
  title={METRIC_LABELS[selectedMetric]}
  valueFormatter={METRIC_FORMATTERS[selectedMetric]}
/>
```

### 4.7 Tareas

| # | Tarea | Archivo |
|---|-------|---------|
| 4.1 | Crear TrendChart component | `frontend/src/components/TrendChart.tsx` |
| 4.2 | Crear estilos | `frontend/src/components/TrendChart.module.css` |
| 4.3 | Crear trends-service.ts | `backend/src/services/trends-service.ts` |
| 4.4 | Agregar endpoint /trends | `backend/src/routes/api.ts` |
| 4.5 | Agregar función a api.ts | `frontend/src/api.ts` |
| 4.6 | Integrar TrendSection en Home | `frontend/src/pages/Home.tsx` |

---

## 5. RENTABILIDAD COMPLETA

### 5.1 Objetivo
Mostrar el P&L de cada reserva sin restricciones. El usuario puede ver todas sus reservas con su rentabilidad real.

### 5.2 Estado actual
La página `/rentabilidad` ya existe pero puede tener datos incompletos o UI básica. Hay que asegurar que:
1. Muestra TODAS las reservas
2. El P&L está calculado correctamente
3. Los filtros funcionan
4. El drawer de detalle muestra todo

### 5.3 Mejoras a implementar

**Página Profitability.tsx:**
- [ ] Tabla con todas las reservas del período
- [ ] Filtros: Canal, Noches (1, 2, 3+), Solo no rentables
- [ ] Ordenamiento por cualquier columna
- [ ] Click para ver detalle en drawer

**ReservationDrawer.tsx:**
- [ ] Mostrar P&L completo con breakdown
- [ ] Mostrar calcNotes (explicación del cálculo)
- [ ] Indicador de confianza

### 5.4 Tareas

| # | Tarea | Archivo |
|---|-------|---------|
| 5.1 | Revisar y mejorar tabla de reservas | `frontend/src/pages/Profitability.tsx` |
| 5.2 | Agregar filtros funcionales | `frontend/src/pages/Profitability.tsx` |
| 5.3 | Mejorar ReservationDrawer | `frontend/src/components/ReservationDrawer.tsx` |
| 5.4 | Verificar cálculo de P&L | `backend/src/services/reservation-economics-service.ts` |

---

## 📅 PLAN DE EJECUCIÓN

### Sprint 1: Date Range (Día 1-2)

| Orden | Tarea | Estimado |
|-------|-------|----------|
| 1 | Crear DateRangePicker.tsx + estilos | 2h |
| 2 | Actualizar AppContext con dateRange | 1h |
| 3 | Actualizar backend para startDate/endDate | 1h |
| 4 | Actualizar api.ts frontend | 30min |
| 5 | Integrar en Home.tsx | 1h |
| 6 | Testing | 1h |

### Sprint 2: Comparativas (Día 3-4)

| Orden | Tarea | Estimado |
|-------|-------|----------|
| 1 | Crear ComparisonCard.tsx | 1h |
| 2 | Mejorar calculatePeriodComparison (MoM) | 1h |
| 3 | Mejorar calculateYoYComparison | 1h |
| 4 | Agregar comparisons a CommandCenterData | 1h |
| 5 | Integrar sección comparativas en Home | 2h |
| 6 | Testing | 1h |

### Sprint 3: Trends (Día 5-6)

| Orden | Tarea | Estimado |
|-------|-------|----------|
| 1 | Crear trends-service.ts | 2h |
| 2 | Agregar endpoint /trends | 30min |
| 3 | Crear TrendChart.tsx con Recharts | 2h |
| 4 | Selector de métrica | 1h |
| 5 | Integrar en Home | 1h |
| 6 | Testing | 1h |

### Sprint 4: Polish Rentabilidad (Día 7)

| Orden | Tarea | Estimado |
|-------|-------|----------|
| 1 | Revisar página Profitability | 1h |
| 2 | Mejorar filtros | 1h |
| 3 | Mejorar ReservationDrawer | 1h |
| 4 | Testing E2E | 2h |

---

## ✅ CHECKLIST FINAL

### Date Range
- [ ] DateRangePicker funciona con presets y custom
- [ ] AppContext maneja dateRange correctamente
- [ ] Backend acepta startDate/endDate
- [ ] Todas las métricas respetan el rango

### Comparativas
- [ ] MoM muestra mes actual vs anterior
- [ ] YoY muestra vs mismo período año pasado
- [ ] Mensaje claro si no hay datos YoY
- [ ] Colores correctos (verde=mejor, rojo=peor)

### Trends
- [ ] Gráfico muestra últimos 6 meses
- [ ] Selector de métrica funciona
- [ ] Muestra promedio y tendencia
- [ ] Se ve bien en mobile

### Rentabilidad
- [ ] Tabla muestra todas las reservas
- [ ] Filtros funcionan
- [ ] Drawer muestra P&L completo
- [ ] Cálculos son correctos

---

*Documento actualizado: Enero 2026*
*Versión: 2.0 - Plan Único*
