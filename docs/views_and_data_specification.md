# Financial OS - Especificación de Vistas y Datos v2.2

> Documentación detallada de la interfaz de usuario, componentes y modelos de datos.
> **Actualizado para Command Center Edition (v2.2)**

---

## 🏗️ Arquitectura Frontend

| Capa | Stack |
|------|-------|
| Framework | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS + CSS Modules |
| Gráficos | Recharts |
| Estado | Context API (AuthContext, AppContext) |
| Cliente API | Supabase Client + Fetch (Custom Wrapper) |

---

## 🗺️ Mapa de Vistas (Pages)

| Ruta | Vista | Propósito |
|------|-------|-----------|
| `/` | **Command Center** | Dashboard estratégico (Responde 40 preguntas clave) |
| `/rentabilidad` | **Rentabilidad** | P&L por reserva, tendencias MoM/YoY y break-even |
| `/canales` | **Canales** | Mix de distribución, comisiones y profit neto por canal |
| `/caja` | **Caja** | Runway, reconciliación y aging de cobranzas |
| `/acciones` | **Acciones** | Recomendaciones estratégicas con tracking de pasos |
| `/costos` | **Costos** | Configuración V4 de costos fijos y variables |
| `/importar` | **Importar** | Upload y validación de reportes CSV de Cloudbeds |

---

## 📊 Detalle de Vistas Principales

### 1. Command Center (Home)
Diseñado para la toma de decisiones en 90 segundos.
- **Hero Metrics**: Net Profit con comparativa inteligente y estado de Break-even.
- **Status Cards**: Ocupación, ADR y Ganancia por Noche con semáforos de salud.
- **Period Summary**: Barra de KPIs rápidos (Revenue, ADR, Noches, Reservas).
- **Contextual Alerts**: Cobranzas pendientes (> $10k) y alertas de calidad de datos.
- **Strategic Mix**: Visualización Directo vs OTAs con alerta de dependencia.

### 2. Rentabilidad y P&L
Análisis profundo de la última línea del negocio.
- **Reservation Drawer**: Al hacer clic en una reserva, muestra:
    - Desglose P&L completo.
    - **Memoria de Cálculo**: Paso a paso de cómo se llegó al resultado.
    - **AI Insights**: Explicación de por qué la reserva fue o no rentable.
- **Tabs de Análisis**:
    - **Tendencias**: Gráficos históricos de 6 meses.
    - **Comparativas**: Tablas MoM (Mes a Mes) y YoY (Año a Año).
    - **Patrones**: Identificación de combinaciones de pérdida.

### 3. Gestión de Costos (V4)
Configuración flexible sin fricción.
- **Categorías Flexibles**: Permite agregar cualquier costo fijo o variable.
- **Unit Economics**: Configuración de costos de limpieza por estadía vs mensuales.
- **Comisiones**: Configuración por canal detectado automáticamente en los reportes.
- **Break-even Preview**: Muestra el impacto inmediato de los cambios en el punto de equilibrio.

---

## 🧩 Componentes de UI Clave

| Componente | Descripción |
|------------|-------------|
| `MetricCard` | Card principal con valor, delta y badge de confianza. |
| `StatusCard` | Indicador con semáforo (good/warning/bad) y subtexto. |
| `ActionCard` | Card interactiva para la "Acción de la Semana". |
| `DataConfidenceBanner` | Banner que indica el nivel de precisión de los datos (●/◐/○). |
| `ReservationDrawer` | Panel lateral para el detalle atómico de una reserva. |
| `BreakevenGauge` | Visualización circular del progreso hacia el punto de equilibrio. |

---

## 📦 Modelos de Datos (Frontend Types)

### CommandCenterData
```typescript
{
  period: { start, end, days },
  health: { netProfit, kpis, topAlert },
  breakeven: { breakEvenOccupancy, currentOccupancy, gapToBreakEven },
  unitEconomics: { profitPerNight, cpor, costMix },
  channels: { otaDependency, bestChannel, worstChannel },
  cash: { runwayDays, aging, reconciliationGap },
  dataConfidence: { score, level, missingReports }
}
```

### ReservationEconomics
```typescript
{
  reservationNumber, guestName, checkIn, nights,
  revenue, netProfit, marginPercent,
  calcMemory: { steps[] },
  aiInsights: string[],
  trustLevel: 'real' | 'estimated'
}
```

---

## 🎨 Guía de Estilos (Design System)

### Semántica de Colores
- **Éxito/Profit**: `#059669` (Emerald 600)
- **Error/Pérdida**: `#dc2626` (Red 600)
- **Advertencia**: `#d97706` (Amber 600)
- **Marca/Acciones**: `#0f766e` (Teal 700)

### Tipografía
- **Títulos/Cuerpo**: `Plus Jakarta Sans`
- **Datos Numéricos**: `JetBrains Mono` (para alineación perfecta en tablas)

---
*Financial OS v2.2 — Especificación de Frontend*
