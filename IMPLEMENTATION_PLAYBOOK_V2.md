# 🚀 STRATEGIC FINANCIAL OS - IMPLEMENTATION PLAYBOOK (V2)

## 1. VISIÓN GENERAL
Este documento transforma la aplicación de un visor de CSVs a una plataforma de **Inteligencia de Negocio Hotelero (BI) Prescriptiva**. El objetivo es proporcionar al hotelero no solo el análisis histórico, sino herramientas de **simulación de rentabilidad** y **umbrales de equilibrio** para la toma de decisiones.

---

## 2. ARQUITECTURA DE DATOS Y CONFIGURACIÓN (Settings)

### 2.1. Gestión de Costos y Capacidad
Para esta versión, los costos se configuran de forma única (no histórico). Se definen en `/settings` o `/costs`:
- **Room Count:** Total de habitaciones físicas (capacidad instalada).
- **Monthly Fixed Costs:** Gastos fijos totales del mes (alquiler, personal, servicios).
- **Variable Cost per Night:** Costo operativo por habitación ocupada (limpieza, lavandería, amenities).
- **Commission Overrides:** Tasas de comisión por canal (ej: Booking.com 15%, Expedia 18%).

### 2.2. Motor de Prorrateo de Tiempo
**CRÍTICO:** Los costos fijos deben prorratearse según los días del periodo seleccionado vs los días totales del mes comercial (estándar: 30.42 días).
- `ProrratedFixedCosts = MonthlyFixedCosts * (DaysInPeriod / 30.42)`

---

## 3. CATÁLOGO DE MÉTRICAS ESTRATÉGICAS

### A. Rendimiento Operativo (The Big Four)
1.  **Occupancy %:** `(Noches Reales Ocupadas) / (Habitaciones Disponibles)`.
2.  **ADR (Average Daily Rate):** `Room Revenue Neto / Noches Reales Ocupadas`.
3.  **RevPAR:** `Room Revenue Neto / Habitaciones Disponibles`.
4.  **NRevPAR (Net RevPAR):** `(Room Revenue - Comisiones Reales/Estimadas) / Habitaciones Disponibles`.

### B. Rentabilidad y Umbrales (Profitability)
5.  **GOPPAR:** `(Total Revenue - Total Operating Costs) / Habitaciones Disponibles`.
6.  **Break-even Price (Tarifa de Equilibrio):** `(Prorrated Fixed Costs + Total Variable Costs) / Noches Vendidas`.
7.  **Required Nights (Noches de Equilibrio):** 
    - Para cubrir fijos: `Prorrated Fixed Costs / (ADR - Variable Cost Per Night)`.
    - Para cubrir costos totales: `(Prorrated Fixed Costs + Total Variable Costs) / (ADR - Variable Cost Per Night)`.
8.  **Margen de Seguridad:** Visualización del progreso hacia el equilibrio (ej: "Faltan 12 noches para cubrir costos fijos").

---

## 4. MOTOR DE PRICING (Simulador de Tarifas Mínimas)

### 4.1. Lógica del Simulador
Permite al usuario calcular la tarifa mínima de venta para obtener un margen de beneficio deseado.
- **Input:** `MarginPct` (Slider 0% a 50%).
- **Cálculo de Comisión Ponderada:** `AvgCommRate = SUM(RevenueByChannel * CommRateByChannel) / TotalRevenue`.
- **Fórmula de Tarifa Mínima:** 
  `MinPrice = [(ProrratedFixedCosts/NightsSold + VariableCostPerNight) * (1 + MarginPct)] / (1 - AvgCommRate)`

---

## 5. UI/UX: COMPONENTES Y PÁGINAS

### 🏠 Home (Dashboard Ejecutivo)
- **Top Metrics Row:** Occupancy, ADR, RevPAR, NRevPAR.
- **Break-even Card:** Muestra el precio de equilibrio actual y el status (Verde si ADR > Break-even).
- **Margen de Seguridad:** Barra de progreso hacia el cumplimiento de costos fijos.

### 📊 Profitability Page
- **Thresholds Table:** Tabla con umbrales de noches y ocupación para cubrir costos fijos y totales.
- **Pricing Sandbox:** Herramienta interactiva con slider de margen para calcular tarifas mínimas recomendadas.

---

## 6. REGLAS DE ORO (Quality & Trust)

1.  **Confidence Score:**
    - `LOW`: Si falta `Room Count` o no hay noches vendidas.
    - `MEDIUM`: Si se usan comisiones por fallback.
    - `HIGH`: Datos de costos y comisiones completos.
2.  **Alertas Críticas:**
    - **Hemorragia de Efectivo:** Si `ADR < VariableCostPerNight`, mostrar alerta roja: *"Cada reserva genera una pérdida operativa inmediata"*.
3.  **Manejo de Ceros:** Si `Noches Vendidas = 0`, el Break-even es "Indeterminado" (no mostrar error).

---

## 7. MAPEO DE DATOS TÉCNICO

- **Room Revenue:** `ReservationFinancial.room_revenue_total`.
- **Noches:** `ReservationFinancial.room_nights`.
- **Canal de Venta:** `ReservationFinancial.source`.
- **Fechas:** Usar `check_in` para asignar noches al periodo (Prorrateo de estancias que cruzan límites de mes).

---

## 8. ESTRATEGIA DE IMPLEMENTACIÓN

1.  **Backend:** Crear `calculators/pricing-engine.ts` y `calculators/profit-engine.ts`.
2.  **API:** Nuevos endpoints:
    - `GET /api/metrics/:propertyId/break-even`
    - `GET /api/metrics/:propertyId/minimum-price?margin=`
3.  **Frontend:** Integrar slider en `Actions.tsx` o `Profitability.tsx` para simulaciones en tiempo real.
