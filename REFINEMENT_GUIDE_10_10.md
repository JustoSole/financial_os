# Plan de Acción: Financial OS 10/10 (MVS Ready)

Esta guía detalla las correcciones técnicas y de negocio necesarias para eliminar los "puntos ciegos" detectados y llevar la aplicación a una calidad de producción para testeo real.

---

## 1. Cerebro de Análisis: Eliminando Sesgos

### A) Ponderación de Canales (Unbiased Insights)
**Problema:** Un canal con 1 reserva y ADR alto aparece como "Mejor Canal", induciendo a error.
**Solución:** Implementar un **Score de Relevancia** que combine Rentabilidad + Volumen.

*   **Regla de Negocio:** Ningún canal con menos del 5% del revenue total puede ser calificado como "Mejor" o "Peor" de forma absoluta.
*   **Ajuste en `backend/src/services/metrics-service.ts`:**
    ```typescript
    // Filtrar canales significativos antes de calcular Best/Worst
    const significantChannels = channels.filter(c => c.revenueShare >= 0.05);
    const bestChannel = significantChannels.sort((a, b) => b.adrNet - a.adrNet)[0];
    ```

### B) El Factor Limpieza (Unit Economics Real)
**Problema:** Tratar la limpieza como un costo mensual fijo/variable diluye la realidad de las estadías cortas (que son las que suelen perder dinero).
**Solución:** Separar el **Costo por Estadía (CPST)** del **Costo por Noche (CPN)**.

*   **Ajuste en `backend/src/services/calculators/profit-engine.ts`:**
    ```typescript
    // La fórmula de profit por reserva debe ser:
    // Profit = Revenue - Comisión - (Noches * CostoVariableNoche) - (1 * CostoLimpiezaEstadía) - CostoFijoProrrateado
    ```

---

## 2. UX/UI: Navegación y Claridad

### A) Simplificación de la Vista de Rentabilidad
**Problema:** Demasiadas pestañas confunden al hotelero.
**Solución:** Consolidar en 3 flujos lógicos:
1.  **Explorador (Dashboard):** Tendencias, comparativas MoM/YoY y simulador.
2.  **Fugas de Dinero (Alertas):** Patrones de pérdida y peores reservas.
3.  **Auditoría (Tabla):** Todas las reservas con buscador.

### B) Mobile Optimization (Card-Based Layout)
**Problema:** Las tablas no funcionan en móviles.
**Solución:** Usar un layout de "Cards" para móviles en lugar de tablas.
*   En pantallas `< 768px`, ocultar la tabla de reservas y mostrar un listado de tarjetas con: `ID Reserva | Canal | Profit (Badge)`.

---

## 3. Carga de Info: Blindaje de Datos

### A) Validación de Moneda y Coherencia
**Problema:** Riesgo de mezclar ARS con USD.
**Solución:** "Currency Lock" en el Importador.
*   **Lógica:** Al subir el primer CSV, detectar la moneda. Si los siguientes CSVs o la configuración de la propiedad difieren, lanzar un bloqueo (no advertencia, bloqueo) para evitar que el análisis sea basura (Garbage In, Garbage Out).

### B) El "Disclaimer de Vacío" (Empty States)
**Problema:** Si no hay costos, el profit parece irrealmente alto.
**Solución:** Banners de acción obligatoria.
*   Si `fixed_costs == 0`, mostrar un banner rojo en el Home: *"⚠️ Tus ganancias actuales no descuentan gastos fijos. Configura tus costos para ver profit real."*

---

## 4. Guía Técnica de Implementación (Checklist)

| Punto Ciego | Archivo a Modificar | Acción |
| :--- | :--- | :--- |
| **Sesgo de Canales** | `metrics-service.ts` | Añadir `minVolumeThreshold: 0.05` a la lógica de insights. |
| **Costo Limpieza** | `Costs.tsx` y `profit-engine.ts` | Re-activar campo `cleaningPerStay` independiente de los mensuales. |
| **Mobile UI** | `Profitability.module.css` | Añadir Media Queries para transformar tabla en cards. |
| **Validación Moneda** | `csv-parser.ts` | Extraer símbolo de moneda y comparar con `property.currency`. |
| **Explicabilidad** | `ReservationDrawer.tsx` | Añadir desglose: `Revenue - Comm - Clean - Var - Fixed = Profit`. |

---

## Veredicto 10/10
Si se implementan estos 5 cambios, la aplicación deja de ser una "herramienta de visualización" y se convierte en un **"Asesor Financiero Automatizado"**, que es el verdadero valor de un Financial OS.

