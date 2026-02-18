# Frontend Developer Reference

Referencia técnica del frontend (`frontend/`) para implementar cambios sin romper flujos.

## Stack

- React 18 + TypeScript + Vite.
- React Router v6.
- Supabase Auth.
- CSS Modules.
- Vitest + React Testing Library.

Scripts clave:
- `npm run dev --workspace=frontend`
- `npm run build --workspace=frontend`
- `npm run test --workspace=frontend`

## Estructura

### `frontend/src/App.tsx`
Rutas privadas (dentro de `AppProvider` + `PrivateRoute`):

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | Home | Dashboard principal |
| `/acciones` | Actions | Acciones recomendadas |
| `/canales` | Channels | Mix de canales |
| `/rentabilidad` | Profitability | P&L por reserva |
| `/proyecciones` | Projections | Proyecciones OTB |
| `/costos` | Costs | Resumen de costos (read-only) |
| `/importar` | Import | Datos: importar reportes + cargar costos + cerrar mes |
| `/configuracion` | Settings | Configuración del hotel |

### `frontend/src/pages/Import.tsx` (Datos)
Página central de carga de datos con **dos tabs**:
- **Cargar reportes**: wizard de CSV + checklist de cierre + historial.
- **Cargar costos**: formulario con costos fijos/variables/saldo de caja + Copiar/Guardar.

El mes seleccionado y el selector de período + botón "Cerrar mes" están siempre visibles arriba de las tabs.

Soporte de deep-link: `/importar?tab=costos` abre directamente la tab de costos (usado desde la página Costos).

### `frontend/src/pages/Costs.tsx` (Costos)
Página de **visualización read-only** del resumen mensual:
- Selector de período.
- Cards de resumen (fijos, variables, total, caja).
- Desglose por categoría.
- Empty state con CTA "Ir a Datos y cargar costos" (link a `/importar?tab=costos`).
- Link "Editar en Datos".

> No tiene modo "Modelo" ni formularios de edición. Toda la carga de costos se hace en la página Datos.

### `frontend/src/context/`
- `AuthContext.tsx`: sesión de Supabase.
- `AppContext.tsx`: propiedad activa, rango de fechas, métricas, acciones.

### `frontend/src/api.ts`
Cliente API centralizado:
- Inserta `Authorization: Bearer <token>` automáticamente.
- Funciones principales para monthly close: `getMonthlyCosts`, `updateMonthlyCosts`, `copyPreviousMonthCosts`, `getCostCategories`, `getMonthlyCloseDetail`, `closeMonth`, `reopenMonth`, `getImportJobs`.

### `frontend/src/utils/formatters.ts`
Utilidades compartidas:
- `formatMonth(month)`: "2026-02" → "Feb 2026".
- `generateMonthOptions(back, forward)`: genera opciones para dropdowns.
- `formatCurrency`, `formatPercent`, `formatNumber`.

### `frontend/src/components/SidebarContent.tsx`
Navegación principal. Orden: Inicio, Acciones, Canales, Rentabilidad, Proyecciones, Costos, **Datos** (último).

## Patrones recomendados

### Agregar una nueva página
1. Crear archivo en `frontend/src/pages/`.
2. Lazy import en `App.tsx`, registrar ruta.
3. Agregar en `SidebarContent.tsx` si corresponde.

### Agregar integración con endpoint nuevo
1. Crear función tipada en `api.ts`.
2. Definir tipos de respuesta (idealmente en `shared/`).
3. Manejar loading/error/empty en UI.

## Variables de entorno

- `VITE_API_URL` (default `/api`).
- `VITE_SUPABASE_URL`.
- `VITE_SUPABASE_ANON_KEY`.

## Checklist de cambio frontend

- [ ] Confirmar endpoint/contrato de datos.
- [ ] Implementar UI con estados `loading`, `error`, `empty`, `success`.
- [ ] Verificar navegación desktop/mobile.
- [ ] `npm run build --workspace=frontend` sin errores.
- [ ] Smoke test del flujo funcional.
