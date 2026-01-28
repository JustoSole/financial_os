# Financial OS - Especificación de Vistas y Datos v2.3

> Documentación detallada de la interfaz de usuario, componentes y modelos de datos.
> **Actualizado para Profit-First & Taxes Edition (v2.3) - 2026-01-28**

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
| `/cierre-mensual` | **Cierre Mensual** | Resumen ejecutivo, checks de confianza y acciones (Entry point principal) |
| `/rentabilidad` | **Rentabilidad** | P&L por reserva, tendencias MoM/YoY y break-even |
| `/canales` | **Canales** | Mix de distribución, comisiones y **profit neto** por canal |
| `/acciones` | **Acciones** | Recomendaciones estratégicas con tracking de pasos y score de urgencia |
| `/costos` | **Costos** | Configuración V4 de costos + **Módulo de Impuestos v1** |
| `/importar` | **Importar** | Upload y validación de reportes CSV de Cloudbeds |

---

## 📊 Detalle de Vistas Principales

### 1. Cierre Mensual (Nuevo v2.3)
Entry point diseñado para la revisión mensual de salud financiera.
- **Resumen Ejecutivo**: KPIs consolidados (Revenue, Cobrado Real, Pendiente).
- **Checks de Confianza**: 5 validaciones críticas (Cobranza, Comisiones, Costos, Impuestos, Consistencia).
- **Acciones Prioritarias**: Listado de tareas con impacto económico estimado.

### 2. Command Center (Home)
Diseñado para la toma de decisiones en 90 segundos.
- **Confidence Header**: Score de confianza global, fecha de última carga y cobertura de meses.
- **Hero Metrics**: Net Profit con comparativa inteligente y estado de Break-even.
- **Closing CTA**: Botón destacado "Cerrar Mes" para el flujo de fin de período.
- **Status Cards**: Ocupación (unificada), ADR y Ganancia por Noche con semáforos.

### 3. Canales (Profit-First)
Enfoque en la rentabilidad real de cada canal de venta.
- **Profit Share Chart**: Gráfico principal que muestra qué canales dejan dinero "limpio".
- **Simulador de Impacto Directo**: Herramienta interactiva para proyectar ahorro al mover 10pp a venta directa.
- **Costo Real**: Métrica que combina comisión + ADR neto vs benchmark directo.

### 4. Gestión de Costos e Impuestos
- **Módulo de Impuestos v1**: Configuración de IVA, Tasas de Ocupación y Tasas Turísticas.
- **Unit Economics**: Alerta de "Márgenes Inflados" si los costos variables están en 0.

---

## 🧩 Componentes de UI Clave

| Componente | Descripción |
|------------|-------------|
| `ConfidenceHeader` | Header global con score de salud de datos y alertas de cobertura. |
| `MetricCard` | Card principal con valor, delta y badge de confianza. |
| `StatusCard` | Indicador con semáforo (good/warning/bad) y subtexto. |
| `ActionableInsight` | Componente de acción con pasos, evidencia y link al detalle. |
| `ReservationDrawer` | Panel lateral para el detalle atómico de una reserva. |

---

## 📦 Modelos de Datos (Calculated Metrics)

### CommandCenterData
```typescript
{
  period: { start: string, end: string, days: number },
  health: {
    netProfit: { value: number, isPositive: boolean, trend: 'up' | 'down' | 'stable' },
    kpis: { occupancy: KPI, adr: KPI, revpar: KPI, goppar: KPI }
  },
  structure: { occupancyRate: number, ADR: number, RevPAR: number, roomCount: number },
  breakeven: {
    breakEvenOccupancy: number,
    currentOccupancy: number,
    gapToBreakEven: number,
    breakEvenPrice: number
  },
  homeMetrics: {
    projections: { projectedRevenue: number, projectedOccupancy: number, estimatedMonthEnd: number }
  }
}
```

---

## 🗄️ Esquema de Base de Datos (Supabase)

### Tablas Principales
- **`properties`**: Configuración de la propiedad (moneda, plan, timezone).
- **`cost_settings`**: Configuración de costos + **`tax_rules`** (JSON array).
- **`reservation_financials`**: Datos crudos de reservas.
- **`ledger_transactions`**: Transacciones detalladas (pagos, créditos, débitos).
- **`action_completions`**: Tracking de pasos (soporta IDs de string para acciones dinámicas).

---

*Financial OS v2.3 — Especificación de Frontend e Infraestructura*
